// Headless playtest: a bot plays a city for several game years and flags glitches.
//
//   node tests/playtest.mjs [--years 4] [--seed 123] [--k 2] [--poor] [--out report.json]
//
// The game runs in headless Chromium (Playwright). The bot gets plenty of seeds (unless --poor), grows every research node
// it can, unlocks blocks, demolishes, sows and releases animals, while the simulation runs at TICK_K=--k (like catch-up).
// It samples the city every game hour and reports:
//   over-cap       a species stays above what the land can carry (capOf) for more than a season; bees count colonies
//   nan / negative a number on a tile, plant or animal went NaN, infinite or below zero
//   bad-home       an animal's home has stayed somewhere it cannot live for a long while
//   stuck          an animal stands where it cannot stand, or sits far outside its range, for a long while
//   non-local      water cleaned with no plant in it or cleaning plant beside it, or drawn clearer than its own water
//   runaway        one plant covers three quarters of the unlocked land
//   error          page errors and console errors
// The exit code is 1 when anything was flagged, so this can run in CI.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) };
const IDLE = +arg('idle', 0), VISITS = +arg('visits', 2), YEARS = +arg('years', 4), SEED = +arg('seed', 12345), K = +arg('k', 2), POOR = !!arg('poor', false), OUT = arg('out', null);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return }
  let body = fs.readFileSync(f);
  // reach the game's internals: the whole game is one closure, so add an eval hook just before it closes
  if (p === '/index.html') { const s = body.toString(), at = s.lastIndexOf('})();'); body = s.slice(0, at) + 'window.__G=s=>eval(s);\n' + s.slice(at) }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(body);
});
await new Promise(r => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/`;

const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)) });
await page.goto(url);
await page.waitForFunction(() => window.__G && window.__G('typeof S!=="undefined"&&!!S&&!!S.tiles'), null, { timeout: 30000 });

// everything below runs inside the game closure
const setup = (seed, poor) => `(()=>{
  try{localStorage.clear()}catch(e){}
  boot(newGame(${seed}));S.slot=0;S.speed=0;QUIET=true;
  for(const id of ['intro','menu'])if($(id))$(id).hidden=true;
  // keep the page's own frame loop from rendering or ticking: the bot drives the clock
  window.__B={poor:${poor},flag:{},seen:{},ah:{},hist:[],log:[],t0:performance.now(),ticks:0,tickMs:0,maxCount:{}};
  return S.name})()`;

const BOT = `(()=>{
  const B=window.__B;
  if(B.installed)return;B.installed=true;
  B.rnd=(n)=>(Math.random()*n)|0;
  B.flagIt=(kind,key,msg,extra)=>{const id=kind+':'+key;const f=B.flag[id];
    if(f){f.n++;f.last=B.when();return}
    B.flag[id]={kind,key,msg,first:B.when(),last:B.when(),n:1,...(extra||{})}};
  B.when=()=>{if(B.day!=null)return 'day '+(B.day+1).toFixed(1).padStart(4)+' (year '+Math.floor(S.clock/YEAR+1)+')';const y=Math.floor(S.clock/YEAR),s=SEA.idx;return 'y'+(y+1)+' '+['spring','summer','autumn','winter'][s]+' (p '+SEA.p.toFixed(2)+')'};
  // one player session: research, blocks, demolish, sow, release
  B.play=()=>{
    if(!B.poor)S.seeds=Math.max(S.seeds,1e7);
    let changed=false;
    const order=Object.keys(RES).filter(k=>resOpen(k)&&!(RES[k].max?lvl(k)>=RES[k].max:has(k))).sort((a,b)=>resCost(a)-resCost(b));
    for(const k of order){const R0=RES[k];if(R0.max?lvl(k)>=R0.max:has(k))continue;if(!resOpen(k))continue;const c=resCost(k);if(S.seeds<c)continue;S.seeds-=c;S.res[k]=lvl(k)+1;changed=true;B.log.push([B.when(),'research '+k+(RES[k].max?' '+lvl(k):''),c])}
    if(S.blocks)for(let more=true;more;){more=false;for(let b=0;b<S.blocks.length;b++){const st=blockStatus(b);if(st.ok&&S.seeds>=st.cost){S.seeds-=st.cost;S.blocks[b].u=true;refreshUnlock();changed=true;more=true;B.log.push([B.when(),'block '+(ownedBlocks())+' '+S.blocks[b].name,st.cost]);break}}}
    if(changed)computeDerived();
    const U=[];for(let i=0;i<N*N;i++)if(S.tiles[i].u)U.push(i);
    // demolish: a few buildings and some paving each session
    let hits=0;for(let k=0;k<400&&hits<25;k++){const i=U[B.rnd(U.length)],x=i%N,y=(i/N)|0,t=S.tiles[i];
      if(t.b&&!t.b.rp){hitBuilding(x,y,B.poor?power():99,'hand');hits++}
      else if(['road','pave','rubble','path','garden'].includes(t.gd)){hitGround(x,y,B.poor?power():99,'hand');hits++}}
    // sow: random open soil with a random plant that may go there
    const sowable=Object.keys(FLORA).filter(k=>!VBASE[k]&&has(k)&&!FLORA[k].pre&&!FLORA[k].managed&&!FLORA[k].crop);
    let sown=0;for(let k=0;k<300&&sown<20&&sowable.length;k++){const i=U[B.rnd(U.length)],x=i%N,y=(i/N)|0,t=S.tiles[i];if(t.gd!=='soil'||t.p)continue;
      const id=sowable[B.rnd(sowable.length)];if(sowRule(id,x,y))continue;tool={type:'sow',id};if(apply(x,y,true))sown++}
    // a pond now and then
    if(Math.random()<.3){for(let k=0;k<50;k++){const i=U[B.rnd(U.length)],x=i%N,y=(i/N)|0,t=S.tiles[i];if(t.gd==='soil'&&!t.b&&!t.p){tool={type:'dig',id:'dig'};apply(x,y,true);break}}}
    // release: every species that can be released by hand, where it has habitat, up to what the land can carry
    for(const sp in FAUNA){if(ARRIVE[sp]||!has(sp)||!TOOLS[sp])continue;const F=FAUNA[sp],n=D.fa[sp]||0,want=F.cls==='insect'||sp==='bee'?1:2;
      if(n>=want&&!(sp==='bee'&&n<capOf(sp)))continue;if(sp==='bee'&&SEA.p>=1.5)continue;
      for(let k=0;k<200;k++){const i=U[B.rnd(U.length)],x=i%N,y=(i/N)|0;if(!canStand(F.mv,S.tiles[i])||!habitatNear(sp,x,y))continue;
        tool={type:'reintro',id:sp};for(let j=0;j<want;j++)apply(x,y,true);break}}
    tool={type:'inspect',id:'inspect'};computeDerived();
  };
  const NUM=['fert','tox','g','ds','sn','dw','ash','ph','ho','hp','gr','pk','stony','poor','fire'];
  // look at the city: caps, NaN, homes, stuck animals, runaway plants
  B.check=()=>{
    computeDerived();
    const cnt={};for(const a of S.an)cnt[a.sp]=(cnt[a.sp]||0)+1;
    const row={t:+(S.clock/YEAR).toFixed(3),sea:SEA.idx,p:+SEA.p.toFixed(2),an:cnt,cap:{},seeds:Math.round(S.seeds),inc:+(D.income||0).toFixed(2),bio:Math.round(D.bio||0),stage:S.stage,owned:ownedBlocks(),wild:wildBlocks()};
    for(const sp in cnt){const cap=capOf(sp);row.cap[sp]=cap;let n=cnt[sp];
      if(sp==='bee'){const nests=S.an.filter(a=>a.sp==='bee'&&a.st==='nest').length,hib=cnt.bee-nests;row.bee={nests,hib,cap};
        // a colony is a nest; queens asleep for the winter replace this year's nests
        // sleeping queens may outnumber the winter's flowers: only nests have to fit
        n=nests}
      B.maxCount[sp]=Math.max(B.maxCount[sp]||0,n);
      const o=B.ov=B.ov||{};
      if(n>cap&&n>1){o[sp]=o[sp]||{since:S.clock,max:0};o[sp].max=Math.max(o[sp].max,n/Math.max(cap,1));
        if(S.clock-o[sp].since>YEAR/4)B.flagIt('over-cap',sp,sp+': '+n+' living on land that carries '+cap+(sp==='bee'?' colonies':''),{ratio:+o[sp].max.toFixed(2)})}
      else delete o[sp]}
    // numbers that went bad
    if(!isFinite(S.seeds))B.flagIt('nan','S.seeds','S.seeds is '+S.seeds);
    for(let i=0;i<N*N;i++){const t=S.tiles[i];
      for(const k of NUM){const v=t[k];if(v==null||typeof v!=='number')continue;if(!isFinite(v))B.flagIt('nan','tile.'+k,'tile '+i+' '+k+'='+v);else if(v<-1e-6&&k!=='gr')B.flagIt('negative','tile.'+k,'tile '+i+' '+k+'='+v.toFixed(3))}
      if(t.p){const g=t.p.g;if(!isFinite(g))B.flagIt('nan','plant.g','tile '+i+' '+t.p.id+' g='+g);else if(g<0||g>1.0001)B.flagIt('negative','plant.g','tile '+i+' '+t.p.id+' g='+g);if(!FLORA[t.p.id])B.flagIt('nan','plant.id','unknown plant '+t.p.id)}}
    const ah=B.ah,alive=new Set;
    for(const a of S.an){alive.add(a.id);const F=FAUNA[a.sp];
      for(const k of ['x','y','hx','hy','tx','ty','col']){const v=a[k];if(v!=null&&!isFinite(v))B.flagIt('nan','animal.'+k,a.sp+' '+k+'='+v)}
      if(a.col<0)B.flagIt('negative','animal.col',a.sp+' col='+a.col);
      if(!inb(Math.round(a.x),Math.round(a.y))||!inb(a.hx,a.hy)){B.flagIt('stuck','oob:'+a.sp,a.sp+' outside the map at '+a.x.toFixed(1)+','+a.y.toFixed(1));continue}
      const h=ah[a.id]=ah[a.id]||{badHome:0,badStand:0,far:0};
      const homeBad=a.st!=='hib'&&!homeOk(a.sp,a.hx,a.hy);h.badHome=homeBad?h.badHome+1:0;
      if(h.badHome===12)B.flagIt('bad-home',a.sp,a.sp+' kept a home it cannot live in for 12 game hours ('+a.hx+','+a.hy+' '+(T(a.hx,a.hy).b?'building':T(a.hx,a.hy).gd)+')');
      const cx=Math.round(a.x),cy=Math.round(a.y),inHole=a.st==='hib';
      const standBad=!inHole&&F.mv!=='fly'&&!canStand(F.mv,T(cx,cy))&&!canCross(F.mv,T(cx,cy));h.badStand=standBad?h.badStand+1:0;
      if(h.badStand===6)B.flagIt('stuck','stand:'+a.sp,a.sp+' stuck on '+(T(cx,cy).b?'a building':T(cx,cy).gd)+' at '+cx+','+cy+' for 6 game hours');
      const d=Math.max(Math.abs(a.x-a.hx),Math.abs(a.y-a.hy)),farOut=!inHole&&!(a.path&&a.path.length)&&d>F.range+3;h.far=farOut?h.far+1:0;
      if(h.far===6)B.flagIt('stuck','far:'+a.sp,a.sp+' '+d.toFixed(1)+' tiles from home (range '+F.range+') for 6 game hours')}
    for(const id in ah)if(!alive.has(+id))delete ah[id];
    // cleaning is local: a water tile only gets cleaner with a cleaning plant within 1 tile, and its colour follows its own water
    const wt=B.wt||(B.wt=new Float32Array(N*N).fill(-1));
    for(let i=0;i<N*N;i++){const t=S.tiles[i];if(t.gd!=='water'||!t.u){wt[i]=-1;continue}const was=wt[i];wt[i]=t.tox;if(was<0||t.tox>=was-.01)continue; // a cleaner that died within the hour leaves a trace, so only a real drop counts
      const x=i%N,y=(i/N)|0;let cleaner=!!(t.p&&!FLORA[t.p.id].crop); // a plant growing in the water (water-lily) cleans its own tile
      for(let dy=-1;dy<=1&&!cleaner;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(!inb(nx,ny))continue;const n=T(nx,ny);if(n.p&&EFF[n.p.id]&&EFF[n.p.id].dt){cleaner=true;break}}
      if(!cleaner)B.flagIt('non-local','water-clean','water at '+x+','+y+' got cleaner ('+was.toFixed(2)+' to '+t.tox.toFixed(2)+') with nothing cleaning it within 1 tile')}
    {const wc=waterCols();let lo=null,hi=null;for(const t of S.tiles){if(t.gd!=='water'||!t.u)continue;if(!lo||t.tox<lo.tox)lo=t;if(!hi||t.tox>hi.tox)hi=t}
      if(lo&&hi&&hi.tox-lo.tox>.3&&wc.at&&wc.at(hi).cl>=wc.at(lo).cl)B.flagIt('non-local','water-colour','dirty water ('+hi.tox.toFixed(2)+') is drawn as clear as clean water ('+lo.tox.toFixed(2)+')')}
    // runaway: one plant (all its levels) over most of the land
    let land=0;const pc={};for(const t of S.tiles){if(!t.u||t.gd==='water')continue;land++;if(t.p){const b=bid(t.p.id);pc[b]=(pc[b]||0)+1}}
    row.plants=pc;
    for(const k in pc)if(land>200&&pc[k]/land>.75&&k!=='weeds')B.flagIt('runaway',k,k+' covers '+Math.round(100*pc[k]/land)+'% of the unlocked land');
    B.hist.push(row);
  };
  // run the clock: one game hour (DAY/24) per call, the way catch-up does it
  B.hour=()=>{
    const steps=Math.max(1,Math.round(DAY/24/window.__K));
    const t0=performance.now();
    for(let k=0;k<steps;k++){TICK_K=window.__K;S.clock+=window.__K;updateTime();tick();TICK_K=1;
      // let the animals walk about, so we can see the ones that get stuck
      for(let j=0;j<window.__K;j++)updateAnimals(1);B.ticks++}
    B.tickMs+=performance.now()-t0;
  };
})()`;

const name = await page.evaluate(s => window.__G(s), setup(SEED, POOR));
await page.evaluate(k => { window.__K = k }, K);
await page.evaluate(s => window.__G(s), BOT);
console.log(`Playing ${name} (seed ${SEED}) for ${YEARS} game years at ${K} s per tick${POOR ? ', earning seeds' : ', with plenty of seeds'}`);

const DAYS = await page.evaluate(() => window.__G('YEAR/DAY'));
if (IDLE) {
  // a mostly idle player: a few short visits a day, the game catching up on the time between, exactly as on the phone
  const gap = 24 * 3600 / VISITS;
  console.log(`Idle play: ${VISITS} visits a day for ${IDLE} days, ${gap / 3600} hours apart (catch-up covers 12 h, then a seed trickle)`);
  for (let v = 0; v < IDLE * VISITS; v++) {
    await page.evaluate(d => window.__G(`(__B.day=${d},__B.play(),__B.hour(),__B.play())`), v / VISITS);
    await page.evaluate(g => window.__G(`(catchUp(${g},false),0)`), gap);
    await page.waitForFunction(() => window.__G('!catching'), null, { timeout: 600000, polling: 200 });
    const s = await page.evaluate(() => window.__G(`(QUIET=true,__B.check(),(()=>{const r=__B.hist[__B.hist.length-1];return {when:__B.when(),bio:r.bio,inc:r.inc,own:r.owned,wild:r.wild,seeds:r.seeds,stage:r.stage,an:Object.values(r.an).reduce((a,b)=>a+b,0),flags:Object.keys(__B.flag).length}})())`));
    if (v % VISITS === 0) console.log(`${s.when}  blocks ${String(s.own).padStart(2)} (${s.wild} wild)  bio ${String(s.bio).padStart(4)}  stage ${s.stage}  income ${s.inc}/s  seeds ${s.seeds}  animals ${s.an}  flags ${s.flags}`);
  }
}
let lastLine = '';
for (let d = 0; d < (IDLE ? 0 : YEARS * DAYS); d++) {
  await page.evaluate(() => window.__G('__B.play()'));
  for (let h = 0; h < 24; h++) await page.evaluate(() => window.__G('(__B.hour(),__B.check())'));
  const s = await page.evaluate(() => window.__G(`(()=>{const r=__B.hist[__B.hist.length-1];return {when:__B.when(),an:r.an,bee:r.bee,bio:r.bio,flags:Object.keys(__B.flag).length,ms:__B.tickMs/Math.max(1,__B.ticks)}})()`));
  const line = `${s.when.padEnd(26)} bio ${String(s.bio).padStart(5)}  animals ${Object.values(s.an).reduce((a, b) => a + b, 0)}${s.bee ? `  bees ${s.bee.nests} nests/${s.bee.hib} queens of ${s.bee.cap}` : ''}  flags ${s.flags}  ${s.ms.toFixed(1)} ms/tick`;
  if (d % 3 === 0 || s.flags && line !== lastLine) console.log(line);
  lastLine = line;
}

const rep = await page.evaluate(() => window.__G('({flags:Object.values(__B.flag),max:__B.maxCount,log:__B.log,hist:__B.hist,blocks:S.blocks?S.blocks.map((B,b)=>B.u?null:{name:B.name,type:B.t,...blockStatus(b)}).filter(x=>x&&(x.ok||!/neighbouring/.test(x.msg))):[],locked:Object.keys(RES).filter(k=>RES[k].max?lvl(k)<RES[k].max:!has(k)).map(k=>({k,cost:resCost(k),lvl:lvl(k),why:resOpen(k)?"":webWhy(k)}))})'));
const errN = new Map(); for (const e of errors) errN.set(e, (errN.get(e) || 0) + 1);
for (const [e, n] of errN) rep.flags.push({ kind: 'error', key: e.slice(0, 80), msg: e, n });
await browser.close(); server.close();

if (POOR) { console.log('\nWhat the bot bought:'); for (const l of rep.log) console.log('  ' + l.join('  '));
  console.log('\nBlocks next in line:'); for (const b of rep.blocks) console.log(`  ${b.name} (${b.type})  ${b.ok ? b.cost + ' seeds' : b.msg}`);
  console.log('\nStill locked at the end:'); for (const l of rep.locked) console.log(`  ${l.k}${l.lvl ? ' ' + (l.lvl + 1) : ''}  ${l.cost} seeds  ${l.why}`) }
console.log(`\nMost of each species at once: ${Object.entries(rep.max).map(([k, v]) => k + ' ' + v).join(', ')}`);
if (!rep.flags.length) console.log('\nNo glitches found.');
else {
  console.log(`\n${rep.flags.length} glitch${rep.flags.length > 1 ? 'es' : ''} found:`);
  for (const f of rep.flags) console.log(`  [${f.kind}] ${f.msg}${f.ratio ? ` (peak ${f.ratio}x)` : ''}${f.first ? `, first ${f.first}` : ''}${f.n > 1 ? `, seen ${f.n} times` : ''}`);
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(rep, null, 1));
process.exit(rep.flags.length ? 1 : 0);
