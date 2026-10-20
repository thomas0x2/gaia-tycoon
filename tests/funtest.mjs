// Fun playtest: add one plant or animal at a time, let the city run 4 game years, and log what the player would have seen.
//
//   node tests/funtest.mjs [--seed 12345] [--years 4] [--visits 2] [--release 0] [--out fun.json]
//   --release 0: never release animals by hand, so they only come back by themselves once their home is ready
//
// Each step researches the next species in the Wood Wide Web (cheapest open node, BIO gate respected when possible),
// places it the way a player would (a patch of six tiles, or a pair where it has habitat), then the player checks in
// --visits times over --years game years. At each check-in the bot records the away report exactly as the phone builds it
// (awayStory), every toast, the "coming soon" teasers, discoveries, cascades and rare events, then plays a few minutes:
// one block, one Force level, a dozen taps at buildings and paving. Seeds are topped up so pacing does not decide the order.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) };
const RELEASE = arg('release', '1') !== '0', SEED = +arg('seed', 12345), YEARS = +arg('years', 4), VISITS = +arg('visits', 2), OUT = arg('out', null);

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
  boot(newGame(${SEED}));S.slot=0;S.speed=0;QUIET=true;save=()=>{};frame=()=>{};
  for(const id of ['intro','menu'])if($(id))$(id).hidden=true;
  window.__F={toasts:[],story:null};
  const F=window.__F,rnd=n=>(Math.random()*n)|0;
  const toast0=toast;toast=(t,b,k)=>{F.toasts.push([Math.floor(S.clock/YEAR)+1,SEASONS[SEA.idx],t,String(b||'').replace(/<[^>]+>/g,'')]);return toast0(t,b,k)};
  showAway=(a,b,extra)=>{const r=awayStory(a.snap,offLog);F.story={title:r.big?'Something happened!':r.story.some(e=>e.pri)?'Nature has been busy':'A quiet spell',
    items:r.story.map(e=>({tag:e.tag,title:e.title,pri:Math.round(e.pri),line:e.line})),more:r.more,seeds:Math.round(b.seeds-a.seeds)}};
  const species=()=>Object.keys(RES).filter(k=>RES[k].g!=='force');
  F.count=k=>FLORA[k]?S.tiles.filter(t=>t.u&&t.p&&bid(t.p.id)===k).length:S.an.filter(a=>a.sp===k).length;
  F.census=()=>{const o={};for(const t of S.tiles)if(t.u&&t.p){const k=bid(t.p.id);o[k]=(o[k]||0)+1}for(const a of S.an)o[a.sp]=(o[a.sp]||0)+1;return o};
  F.ground=()=>{const o={};for(const t of S.tiles){if(!t.u)continue;const k=t.b?'building':t.gd==='water'?'water':t.p?'stage'+(FLORA[bid(t.p.id)].stage??'?'):t.gd;o[k]=(o[k]||0)+1}return o};
  F.snap=()=>S.tiles.map(t=>(t.p?t.p.id:'')+'|'+t.gd+'|'+(t.b?1:0));
  F.place=k=>{const U=[];for(let i=0;i<N*N;i++)if(S.tiles[i].u)U.push(i);for(let i=U.length-1;i>0;i--){const j=rnd(i+1);[U[i],U[j]]=[U[j],U[i]]}
    if(FLORA[k]){for(const i of U){const x=i%N,y=(i/N)|0;if(sowRule(k,x,y))continue;let n=0;
        for(let r=0;r<=2&&n<6;r++)for(let dy=-r;dy<=r&&n<6;dy++)for(let dx=-r;dx<=r&&n<6;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==r||!inb(x+dx,y+dy))continue;
          if(sowRule(k,x+dx,y+dy))continue;tool={type:'sow',id:k};if(apply(x+dx,y+dy,true))n++}
        if(n)return {n,x,y}}
      return {n:0}}
    if(ARRIVE[k]||!TOOLS[k]||(!${RELEASE}&&FAUNA[k].cls!=='insect'))return {n:0};const Fa=FAUNA[k],want=Fa.cls==='insect'||k==='bee'?1:2;
    for(const i of U){const x=i%N,y=(i/N)|0;if(!canStand(Fa.mv,S.tiles[i])||!habitatNear(k,x,y))continue;tool={type:'reintro',id:k};let n=0;for(let j=0;j<want;j++)if(apply(x,y,true))n++;if(n)return {n,x,y}}
    return {n:0}};
  F.next=()=>{const c=species().filter(k=>!has(k)&&(RES[k].req||[]).every(has)).sort((a,b)=>RES[a].cost-RES[b].cost);
    const ok=c.filter(k=>resOpen(k));return ok[0]?{k:ok[0],forced:false}:c[0]?{k:c[0],forced:true,need:bioNeed(c[0])}:null};
  F.add=k=>{S.res[k]=1;computeDerived();const pl=F.place(k);F.placed={k,x:pl.x,y:pl.y,n:pl.n,snap:F.snap()};return pl};
  F.play=(taps=12)=>{S.seeds=Math.max(S.seeds,1e7);const did=[];
    // a retry for animals that found no habitat yet
    for(const k of species())if(has(k)&&!ARRIVE[k]&&(FLORA[k]||TOOLS[k])&&k!=='weeds'&&!F.count(k)){const pl=F.place(k);if(pl.n){did.push((FLORA[k]?'sowed ':'released ')+k+' again');if(F.placed&&F.placed.k===k){F.placed.x=pl.x;F.placed.y=pl.y;F.placed.snap=F.snap()}}}
    if(S.blocks){let b=-1,bc=Infinity;for(let j=0;j<S.blocks.length;j++){const st=blockStatus(j);if(st.ok&&st.cost<bc){b=j;bc=st.cost}}if(b>=0){S.blocks[b].u=true;refreshUnlock();did.push('block')}}
    const fo=Object.keys(RES).filter(k=>RES[k].g==='force'&&resOpen(k)&&lvl(k)<RES[k].max).sort((a,b)=>lvl(a)-lvl(b)||resCost(a)-resCost(b));if(fo[0]){S.res[fo[0]]=lvl(fo[0])+1;did.push(fo[0]+' '+lvl(fo[0]))}
    computeDerived();
    const U=[];for(let i=0;i<N*N;i++)if(S.tiles[i].u)U.push(i);
    let hits=0;for(let k=0;k<taps*25&&hits<taps;k++){const i=U[rnd(U.length)],x=i%N,y=(i/N)|0,t=S.tiles[i];
      if(t.b&&!t.b.rp){hitBuilding(x,y,power(),'hand');hits++}else if(['road','pave','rubble','path','garden'].includes(t.gd)){hitGround(x,y,power(),'hand');hits++}}
    tool={type:'inspect',id:'inspect'};computeDerived();return did};
  F.live=s=>{for(let k=0;k<s;k++){S.clock+=1;updateTime();tick();updateAnimals(1)}};
  F.state=()=>{computeDerived();return {yr:+(S.clock/YEAR).toFixed(2),bio:Math.round(D.bio||0),inc:+(D.income||0).toFixed(1),census:F.census(),ground:F.ground(),
    fx:Object.keys(S.fx||{}),vets:(S.vets||[]).map(v=>v.n),ud:S.tiles.filter(t=>t.u&&t.p&&t.p.ud).length,wild:Object.keys(S.wild||{}),rec:Object.keys(S.rec||{}),blocks:ownedBlocks(),ev:(histOf().ev||[]).length}};
  F.near=()=>{const pl=F.placed;if(!pl||pl.x==null)return null;const now=F.snap();let near=0,all=0;for(let i=0;i<now.length;i++)if(now[i]!==pl.snap[i]){all++;if(Math.max(Math.abs(i%N-pl.x),Math.abs(((i/N)|0)-pl.y))<=4)near++}return {near,all}};
  F.soon=()=>{try{return comingSoon().slice(0,5).map(s=>s.title+(s.dt!=null?' ('+soonWhen(s.dt)+')':''))}catch(e){return ['comingSoon error: '+e.message]}};
  F.evSince=n=>(histOf().ev||[]).slice(n).map(e=>{try{return chronText(e).replace(/<[^>]+>/g,' ').replace(/\\s+/g,' ').trim()}catch(_){return e.join(' ')}});
  F.fxText=k=>FX[k]?fxName(k)+': '+String(FX[k].text||'').replace(/<[^>]+>/g,''):k;
})()`);

const total = await G('Object.keys(RES).filter(k=>RES[k].g!=="force").length');
const gap = YEARS * 7200 / VISITS;
console.log(`Fun playtest: seed ${SEED}, ${YEARS} game years per species, ${VISITS} check-ins each (${gap / 3600} h real gaps)`);
const steps = [];
// the first session: clear some ground before anything can grow
for (let r = 0; r < 4; r++) { await G('__F.live(150)'); await G('__F.play(30)') }
const S0 = await G('__F.state()');
steps.push({ k: 'start', before: null, after: S0 });
for (let n = 0; n < 40; n++) {
  const nx = await G('__F.next()');
  if (!nx) break;
  const before = await G('__F.state()');
  const pl = await G(`__F.add(${JSON.stringify(nx.k)})`);
  const visits = [];
  for (let v = 0; v < VISITS; v++) {
    const ev0 = (await G('__F.state()')).ev;
    await G('__F.toasts.length=0;__F.story=null');
    await G(`(catchUp(${gap},true),0)`);
    await page.waitForFunction(() => window.__G('!catching'), null, { timeout: 1800000, polling: 250 });
    await G('QUIET=true');
    const story = await G('__F.story'), toasts = await G('__F.toasts.slice()'), evs = await G(`__F.evSince(${ev0})`), soon = await G('__F.soon()'), near = await G('__F.near()');
    await G('__F.live(300)');
    const did = await G('__F.play()');
    visits.push({ story, toasts, evs, soon, near, did });
  }
  const after = await G('__F.state()');
  const newFx = after.fx.filter(k => !before.fx.includes(k));
  const fxText = [];
  for (const k of newFx) fxText.push(await G(`__F.fxText(${JSON.stringify(k)})`));
  const step = { k: nx.k, forced: nx.forced, need: nx.need, placed: pl, before, after, visits, newFx: fxText, newRec: after.rec.filter(k => !before.rec.includes(k)) };
  steps.push(step);
  const d = {}; for (const k of new Set([...Object.keys(before.census), ...Object.keys(after.census)])) { const a = before.census[k] || 0, b = after.census[k] || 0; if (a !== b) d[k] = `${a}→${b}` }
  console.log(`\n=== ${n + 1}. ${nx.k}${nx.forced ? ` (past BIO gate, needs ${nx.need})` : ''}  placed ${pl.n}  year ${before.yr}→${after.yr}  bio ${before.bio}→${after.bio}  income ${before.inc}→${after.inc}`);
  console.log('  census: ' + Object.entries(d).map(([k, v]) => k + ' ' + v).join(', '));
  console.log('  ground: ' + JSON.stringify(after.ground));
  console.log(`  veterans ${after.vets.length}${after.vets.length ? ': ' + after.vets.slice(0, 4).join('; ') : ''}  understorey ${after.ud}  wild returns ${after.wild.join(' ') || '-'}`);
  for (const [i, v] of visits.entries()) {
    console.log(`  check-in ${i + 1}: "${v.story?.title}" +${v.story?.seeds} seeds, near-change ${v.near ? v.near.near + '/81' : '-'}  ${v.did.join(', ')}`);
    for (const e of v.story?.items || []) console.log(`     [${e.pri}] ${e.tag}: ${e.title}`);
    if (v.story?.more) console.log(`     …and ${v.story.more} smaller`);
    for (const e of v.evs) console.log(`     chron: ${e}`);
    for (const t of v.toasts.filter(t => !/^Cascade discovered/.test(t[2]))) console.log(`     toast y${t[0]} ${t[1]}: ${t[2]}`);
    console.log(`     soon: ${v.soon.join(' | ')}`);
  }
  for (const t of fxText) console.log('  FX ' + t);
  if (step.newRec.length) console.log('  cascades: ' + step.newRec.join(', '));
}
await browser.close(); server.close();
if (errors.length) console.log('\nPage errors:\n  ' + [...new Set(errors)].join('\n  '));
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ seed: SEED, years: YEARS, visits: VISITS, total, steps, errors }, null, 1));
