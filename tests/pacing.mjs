// Pacing bot: how often does the Wood Wide Web give a check-in player something new, and how much does it change the city?
//
//   node tests/pacing.mjs [--days 5] [--seed 12345] [--visits 8,13,18,23] [--out curve.json] [--csv curve.csv]
//
// The target (Thomas, 2026-10-19): someone who looks in every 4–6 hours unlocks about one new plant or animal per visit,
// places it, and on the next visit sees what it did. The bot plays like that: at each visit (hours of the day in --visits)
// it plays live for a few minutes, buys the cheapest open plant or animal it can afford, sows or releases it (and retries animals that found no habitat yet), spends
// half of what is left on blocks and forces, then leaves; the game catches up the gap exactly as on the phone.
// Each visit prints the real time, what was unlocked, what the next unlock waits for (seeds, BIO or a parent node),
// and how far the last new species spread while the player was away.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) };
const DAYS = +arg('days', 5), SEED = +arg('seed', 12345), OUT = arg('out', null), CSV = arg('csv', null);
const HOURS = String(arg('visits', '8,13,18,23')).split(',').map(Number).sort((a, b) => a - b);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return }
  let body = fs.readFileSync(f);
  if (p === '/index.html') { const s = body.toString(), at = s.lastIndexOf('})();'); body = s.slice(0, at) + 'window.__G=s=>eval(s);\n' + s.slice(at) }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(body);
});
await new Promise(r => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/`;
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = [];
page.on('pageerror', e => errors.push((e.stack || e.message).split('\n').slice(0, 3).join(' | ')));
await page.goto(url);
await page.waitForFunction(() => window.__G && window.__G('typeof S!=="undefined"&&!!S&&!!S.tiles'), null, { timeout: 30000 });
const G = s => page.evaluate(s => window.__G(s), s);

await G(`(()=>{try{localStorage.clear()}catch(e){}
  boot(newGame(${SEED}));S.slot=0;S.speed=0;QUIET=true;save=()=>{};
  // stop the page's own frame loop: it would start a catch-up of its own when the bot keeps it waiting, and ours would then be skipped
  frame=()=>{};
  for(const id of ['intro','menu'])if($(id))$(id).hidden=true;
  window.__P={rows:[],placed:null};
  const P=window.__P,rnd=n=>(Math.random()*n)|0;
  const species=()=>Object.keys(RES).filter(k=>RES[k].g!=='force');
  P.count=k=>FLORA[k]?S.tiles.filter(t=>t.p&&bid(t.p.id)===k).length:S.an.filter(a=>a.sp===k).length;
  P.snap=()=>S.tiles.map(t=>(t.p?t.p.id:'')+'|'+t.gd+'|'+(t.b?1:0));
  // live play: a few minutes at real speed
  P.live=s=>{for(let k=0;k<s;k++){S.clock+=1;updateTime();tick();updateAnimals(1)}};
  // place the new thing the way a player would: a patch of six tiles where it may grow, or a pair where it has habitat
  P.place=k=>{const U=[];for(let i=0;i<N*N;i++)if(S.tiles[i].u)U.push(i);for(let i=U.length-1;i>0;i--){const j=rnd(i+1);[U[i],U[j]]=[U[j],U[i]]}
    if(FLORA[k]){for(const i of U){const x=i%N,y=(i/N)|0;if(sowRule(k,x,y))continue;let n=0;
        for(let r=0;r<=2&&n<6;r++)for(let dy=-r;dy<=r&&n<6;dy++)for(let dx=-r;dx<=r&&n<6;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==r||!inb(x+dx,y+dy))continue;
          if(sowRule(k,x+dx,y+dy))continue;tool={type:'sow',id:k};if(apply(x+dx,y+dy,true))n++}
        if(n)return {n,x,y}}
      return {n:0}}
    if(ARRIVE[k]||!TOOLS[k])return {n:0};const F=FAUNA[k],want=F.cls==='insect'||k==='bee'?1:2;
    for(const i of U){const x=i%N,y=(i/N)|0;if(!canStand(F.mv,S.tiles[i])||!habitatNear(k,x,y))continue;tool={type:'reintro',id:k};let n=0;for(let j=0;j<want;j++)if(apply(x,y,true))n++;if(n)return {n,x,y}}
    return {n:0}};
  P.gate=()=>{const open=[],shut=[];for(const k of species()){if(has(k))continue;(resOpen(k)?open:shut).push(k)}
    open.sort((a,b)=>resCost(a)-resCost(b));
    const bio=shut.filter(k=>(RES[k].req||[]).every(has)&&secretOk(k)).sort((a,b)=>bioNeed(a)-bioNeed(b));
    return {open,next:open[0]||null,cost:open[0]?resCost(open[0]):null,bioNext:bio[0]||null,bioNeed:bio[0]?bioNeed(bio[0]):null}};
  P.visit=()=>{
    const got=[];
    // the new thing: every plant or animal the player can afford (the target is about one a visit)
    for(;;){const g=P.gate();if(!g.next||S.seeds<g.cost)break;S.seeds-=g.cost;S.res[g.next]=1;computeDerived();got.push([g.next,g.cost]);
      const pl=P.place(g.next);P.placed={k:g.next,at:S.clock,n0:P.count(g.next),x:pl.x,y:pl.y,snap:P.snap()}}
    // animals that found no habitat when they were bought: try again, as a player would once the place is ready
    for(const k of species())if(FAUNA[k]&&has(k)&&!ARRIVE[k]&&TOOLS[k]&&!P.count(k)){const pl=P.place(k);if(pl.n&&P.placed&&P.placed.k===k){P.placed.n0=P.count(k);P.placed.x=pl.x;P.placed.y=pl.y}}
    // half of what is left on blocks, then forces
    let budget=S.seeds/2;
    if(S.blocks)for(let more=true;more;){more=false;for(let b=0;b<S.blocks.length;b++){const st=blockStatus(b);if(st.ok&&st.cost<=budget){S.seeds-=st.cost;budget-=st.cost;S.blocks[b].u=true;refreshUnlock();more=true;break}}}
    for(const k of Object.keys(RES).filter(k=>RES[k].g==='force'&&resOpen(k)&&lvl(k)<RES[k].max).sort((a,b)=>resCost(a)-resCost(b))){const c=resCost(k);if(c<=budget){S.seeds-=c;budget-=c;S.res[k]=lvl(k)+1}}
    computeDerived();
    // a few taps at buildings and paving, the way a player clears ground while there
    const U=[];for(let i=0;i<N*N;i++)if(S.tiles[i].u)U.push(i);
    let hits=0;for(let k=0;k<300&&hits<12;k++){const i=U[rnd(U.length)],x=i%N,y=(i/N)|0,t=S.tiles[i];
      if(t.b&&!t.b.rp){hitBuilding(x,y,power(),'hand');hits++}else if(['road','pave','rubble','path','garden'].includes(t.gd)){hitGround(x,y,power(),'hand');hits++}}
    tool={type:'inspect',id:'inspect'};computeDerived();
    return got};
  // how the city looks now, and how far the last new species got
  P.look=()=>{computeDerived();const g=P.gate(),pl=P.placed;let spread=null;
    if(pl){const now=P.snap();let ch=0,near=0;for(let i=0;i<now.length;i++)if(now[i]!==pl.snap[i]){ch++;if(pl.x!=null&&Math.max(Math.abs(i%N-pl.x),Math.abs(((i/N)|0)-pl.y))<=4)near++}
      spread={k:pl.k,n0:pl.n0,n:P.count(pl.k),changed:ch,near,hours:+((S.clock-pl.at)/3600).toFixed(1)}}
    return {seeds:Math.round(S.seeds),inc:+(D.income||0).toFixed(1),bio:Math.round(D.bio||0),peak:Math.round(S.peak||0),blocks:ownedBlocks(),
      have:species().filter(has).length,of:species().length,fx:Object.keys(S.fx||{}).length,next:g.next,cost:g.cost,
      wait:g.next?(S.seeds>=g.cost?0:+((g.cost-S.seeds)/Math.max(.01,D.income)/3600).toFixed(1)):null,bioNext:g.bioNext,bioNeed:g.bioNeed,spread}};
})()`);

const total = await G('Object.keys(RES).filter(k=>RES[k].g!=="force").length');
console.log(`Pacing: seed ${SEED}, visits at ${HOURS.join(', ')} h for ${DAYS} days; ${total} plants and animals in the Wood Wide Web`);
const rows = [];
let hourNow = HOURS[0], realH = 0, lastUnlockH = 0;
for (let d = 0; d < DAYS; d++) for (let v = 0; v < HOURS.length; v++) {
  const before = await G('__P.look()');
  await G('__P.live(300)');
  const got = await G('__P.visit()');
  if (got.length) lastUnlockH = realH;
  const after = await G('__P.look()');
  const row = { day: d + 1, hour: HOURS[v], realH: +realH.toFixed(1), unlocked: got.map(g => g[0]), costs: got.map(g => g[1]), ...before, after: { seeds: after.seeds, next: after.next, cost: after.cost, wait: after.wait, have: after.have } };
  rows.push(row);
  const sp = before.spread ? `last new: ${before.spread.k} ${before.spread.n0}→${before.spread.n} after ${before.spread.hours} h, ${before.spread.near} of 81 tiles around it changed` : '';
  console.log(`day ${d + 1} ${String(HOURS[v]).padStart(2)}:00  ${String(row.realH).padStart(5)} h  have ${String(before.have).padStart(2)}/${total}  bio ${String(before.bio).padStart(5)}  income ${String(before.inc).padStart(7)}/s  blocks ${String(before.blocks).padStart(2)}  ` +
    `${got.length ? 'UNLOCKED ' + got.map(g => g[0] + ' (' + g[1] + ')').join(', ') : 'nothing new'}  next ${after.next || (after.bioNext ? after.bioNext + ' at BIO ' + after.bioNeed : '-')}${after.next ? ' ' + after.cost + ' (' + after.wait + ' h away)' : ''}  ${sp}`);
  // away until the next visit
  const nextH = v + 1 < HOURS.length ? HOURS[v + 1] : HOURS[0] + 24, gap = (nextH - HOURS[v]) * 3600;
  const c0 = await G('S.clock');
  await G(`(catchUp(${gap},false),0)`);
  await page.waitForFunction(() => window.__G('!catching'), null, { timeout: 900000, polling: 200 });
  await G('QUIET=true');
  const ran = (await G('S.clock')) - c0; if (ran < Math.min(gap, 12 * 3600) * .99) throw new Error(`catch-up ran ${ran} s of ${gap}`);
  realH += gap / 3600;
}
await browser.close(); server.close();

const un = rows.filter(r => r.unlocked.length), per = rows.map(r => r.unlocked.length);
const gaps = []; let prev = 0; for (const r of rows) if (r.unlocked.length) { gaps.push(r.realH - prev); prev = r.realH }
console.log(`\n${un.length} of ${rows.length} visits brought something new (${per.reduce((a, b) => a + b, 0)} unlocks; ${per.filter(n => n > 1).length} visits with more than one).`);
console.log(`Real hours between unlocks: ${gaps.map(g => g.toFixed(0)).join(', ')}`);
if (errors.length) console.log('\nPage errors:\n  ' + [...new Set(errors)].join('\n  '));
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ seed: SEED, visits: HOURS, days: DAYS, total, rows, errors }, null, 1));
if (CSV) fs.writeFileSync(CSV, 'day,hour,real_h,have,bio,income,blocks,seeds,unlocked,next,next_cost,wait_h,last_new,last_new_n0,last_new_n,tiles_changed,tiles_changed_near\n' +
  rows.map(r => [r.day, r.hour, r.realH, r.have, r.bio, r.inc, r.blocks, r.seeds, r.unlocked.join(' '), r.after.next || '', r.after.cost ?? '', r.after.wait ?? '', r.spread?.k || '', r.spread?.n0 ?? '', r.spread?.n ?? '', r.spread?.changed ?? '', r.spread?.near ?? ''].join(',')).join('\n') + '\n');
