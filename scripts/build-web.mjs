// Copies the game (with its sprite sheets) into www/, the folder Capacitor bundles into the iOS app.
// The service worker is left out: the app already ships every file it needs.
// The Google Fonts are downloaded into www/fonts/ so the app looks right offline;
// without a network connection the build keeps the online font link instead.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const OUT = 'www';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of ['manifest.webmanifest', 'icons', 'sprites']) cpSync(f, `${OUT}/${f}`, { recursive: true });

let html = readFileSync('index.html', 'utf8');
const link = html.match(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com\/[^"]+)">/);
try {
  if (!link) throw new Error('no Google Fonts link in index.html');
  // a modern browser user agent makes Google serve woff2 files
  const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const res = await fetch(link[1].replaceAll('&amp;', '&'), { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`fonts CSS: HTTP ${res.status}`);
  let css = await res.text();
  mkdirSync(`${OUT}/fonts`);
  const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)'"]+/g) || [])];
  for (const [i, url] of urls.entries()) {
    const font = await fetch(url);
    if (!font.ok) throw new Error(`font file: HTTP ${font.status}`);
    const name = `f${i}.${url.split('.').pop()}`;
    writeFileSync(`${OUT}/fonts/${name}`, Buffer.from(await font.arrayBuffer()));
    css = css.replaceAll(url, name);
  }
  writeFileSync(`${OUT}/fonts/fonts.css`, css);
  html = html
    .replace(/<link rel="preconnect"[^>]*>\n/g, '')
    .replace(link[0], '<link rel="stylesheet" href="fonts/fonts.css">');
  console.log(`Bundled ${urls.length} font files`);
} catch (e) {
  rmSync(`${OUT}/fonts`, { recursive: true, force: true });
  console.warn(`Could not bundle the fonts (${e.message}); the app will load them online.`);
}
writeFileSync(`${OUT}/index.html`, html);
console.log(`Copied the game into ${OUT}/`);
