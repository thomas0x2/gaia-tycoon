// Bakes the code-drawn plants, animals, animal homes and buildings of index.html into PNG sprite sheets in sprites/,
// lists any ground and water textures found in sprites/textures/, and writes sprites/sprites.js,
// the list the game loads them from.
//
//   npm run sprites                  bake every species that has no sheet yet
//   npm run sprites -- oak fox       bake (or re-bake) just these, replacing their sheets
//   npm run sprites -- home-fox      the same for an animal's home (the fox earth)
//   npm run sprites -- house         a building kind re-bakes every look of it (house-2-1-r3 …)
//   npm run sprites -- --force       re-bake everything, replacing every sheet
//   npm run sprites -- --scale=4     pixels per game unit (default 3)
//
// Sheets that already exist are left alone unless named or --force is given, so PNGs you have
// redrawn are never overwritten by accident. The drawing is done in a headless Chromium through Playwright:
// run `npx playwright install chromium` once, or the script falls back to an installed Google Chrome.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const force = args.includes('--force');
const scale = +(args.find(a => a.startsWith('--scale='))?.split('=')[1] || 3);
const only = args.filter(a => !a.startsWith('--'));

const DIR = 'sprites', LIST = `${DIR}/sprites.js`, HEAD = 'window.SPRITE_SHEETS=';
const old = existsSync(LIST) ? JSON.parse(readFileSync(LIST, 'utf8').trim().slice(HEAD.length).replace(/;$/, '')) : {};

let browser;
try { browser = await chromium.launch() }
catch (e) {
  try { browser = await chromium.launch({ channel: 'chrome' }) }
  catch { console.error(`No browser to draw with (${e.message.split('\n')[0]}).\nRun: npx playwright install chromium`); process.exit(1) }
}
const page = await browser.newPage();
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(pathToFileURL(resolve('index.html')).href + '?bake');
await page.waitForFunction(() => window.bakeSprites, null, { timeout: 30000 });
const baked = await page.evaluate(o => window.bakeSprites(o), { scale, only: only.length ? only : null });
await browser.close();

const KINDS = ['plants', 'animals', 'homes', 'buildings'];
const list = { v: old.v, textures: {} };
for (const kind of KINDS) list[kind] = { ...old[kind] };
const counts = { written: 0, kept: 0 };
const named = (kind, id) => kind === 'homes' ? only.includes('home-' + id) : only.includes(id) || (kind === 'buildings' && only.includes(id.split('-')[0]));
for (const kind of KINDS) {
  mkdirSync(`${DIR}/${kind}`, { recursive: true });
  for (const [id, { png, meta }] of Object.entries(baked[kind])) {
    const file = `${kind}/${id}.png`;
    if (existsSync(`${DIR}/${file}`) && !force && !named(kind, id) && list[kind][id]) { counts.kept++; continue }
    writeFileSync(`${DIR}/${file}`, Buffer.from(png.split(',')[1], 'base64'));
    list[kind][id] = { file, ...meta };
    counts.written++;
  }
  // forget sheets whose PNG was deleted, so the game draws those species from code again
  for (const id of Object.keys(list[kind])) if (!existsSync(`${DIR}/${list[kind][id].file}`)) delete list[kind][id];
}
// textures are drawn by hand, not baked: list every PNG in sprites/textures/, keeping any settings already given
mkdirSync(`${DIR}/textures`, { recursive: true });
for (const f of readdirSync(`${DIR}/textures`).filter(f => f.endsWith('.png')).sort()) {
  const id = f.slice(0, -4), png = readFileSync(`${DIR}/textures/${f}`), prev = old.textures?.[id] || {};
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20), cols = prev.w ? Math.max(1, Math.round(w / prev.w)) : 1, rows = prev.h ? Math.max(1, Math.round(h / prev.h)) : 1;
  list.textures[id] = { file: `textures/${f}`, mode: 'overlay', ...prev, w: Math.floor(w / cols), h: Math.floor(h / rows) };
  if (JSON.stringify(list.textures[id]) !== JSON.stringify(prev)) counts.written++;
}
if (counts.written || !list.v) list.v = Date.now().toString(36); // a new version makes browsers fetch the new PNGs
// one line per sheet keeps diffs readable
const body = kind => Object.entries(list[kind]).sort(([a], [b]) => a.localeCompare(b))
  .map(([id, m]) => `    ${JSON.stringify(id)}: ${JSON.stringify(m)}`).join(',\n');
const groups = ['plants', 'animals', 'homes', 'buildings', 'textures'];
writeFileSync(LIST, `${HEAD}{\n  "v": ${JSON.stringify(list.v)},\n${groups.map(g => `  "${g}": {\n${body(g)}\n  }`).join(',\n')}\n};\n`);
console.log(`Wrote ${counts.written} sheets, kept ${counts.kept} existing ones. ${LIST} lists ${groups.map(g => `${Object.keys(list[g]).length} ${g}`).join(', ')}.`);
