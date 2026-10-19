// Bakes the code-drawn plants, animals and animal homes of index.html into PNG sprite sheets in sprites/,
// and writes sprites/sprites.js, the list the game loads them from.
//
//   npm run sprites                  bake every species that has no sheet yet
//   npm run sprites -- oak fox       bake (or re-bake) just these, replacing their sheets
//   npm run sprites -- home-fox      the same for an animal's home (the fox earth)
//   npm run sprites -- --force       re-bake everything, replacing every sheet
//   npm run sprites -- --scale=4     pixels per game unit (default 3)
//
// Sheets that already exist are left alone unless named or --force is given, so PNGs you have
// redrawn are never overwritten by accident. The drawing is done in a headless Chromium through Playwright:
// run `npx playwright install chromium` once, or the script falls back to an installed Google Chrome.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

const list = { v: old.v, plants: { ...old.plants }, animals: { ...old.animals }, homes: { ...old.homes } };
const counts = { written: 0, kept: 0 };
for (const kind of ['plants', 'animals', 'homes']) {
  mkdirSync(`${DIR}/${kind}`, { recursive: true });
  for (const [id, { png, meta }] of Object.entries(baked[kind])) {
    const file = `${kind}/${id}.png`;
    if (existsSync(`${DIR}/${file}`) && !force && !only.includes(kind === 'homes' ? 'home-' + id : id) && list[kind][id]) { counts.kept++; continue }
    writeFileSync(`${DIR}/${file}`, Buffer.from(png.split(',')[1], 'base64'));
    list[kind][id] = { file, ...meta };
    counts.written++;
  }
  // forget sheets whose PNG was deleted, so the game draws those species from code again
  for (const id of Object.keys(list[kind])) if (!existsSync(`${DIR}/${list[kind][id].file}`)) delete list[kind][id];
}
if (counts.written || !list.v) list.v = Date.now().toString(36); // a new version makes browsers fetch the new PNGs
// one line per sheet keeps diffs readable
const body = kind => Object.entries(list[kind]).sort(([a], [b]) => a.localeCompare(b))
  .map(([id, m]) => `    ${JSON.stringify(id)}: ${JSON.stringify(m)}`).join(',\n');
writeFileSync(LIST, `${HEAD}{\n  "v": ${JSON.stringify(list.v)},\n  "plants": {\n${body('plants')}\n  },\n  "animals": {\n${body('animals')}\n  },\n  "homes": {\n${body('homes')}\n  }\n};\n`);
console.log(`Wrote ${counts.written} sheets, kept ${counts.kept} existing ones. ${LIST} lists ${Object.keys(list.plants).length} plants, ${Object.keys(list.animals).length} animals and ${Object.keys(list.homes).length} homes.`);
