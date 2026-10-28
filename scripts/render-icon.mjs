// Renders assets/icon.svg (macOS grid) and assets/icon-square.svg (edge-to-edge, Windows/Linux)
// to 1024×1024 PNGs with headless Chrome. `npm run icon` then runs scripts/make-icons.mjs to
// regenerate src-tauri/icons and static/favicon.png. Env: CHROME_PATH.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VARIANTS = ['icon', 'icon-square'];
const font = path.join(
  ROOT,
  'node_modules/@fontsource/courier-prime/files/courier-prime-latin-700-normal.woff2',
);
const fontFace = `@font-face{font-family:"Courier Prime";font-weight:700;src:url(data:font/woff2;base64,${fs.readFileSync(font).toString('base64')})}`;

const chrome =
  process.env.CHROME_PATH ??
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  defaultViewport: { width: 1024, height: 1024 },
});

for (const name of VARIANTS) {
  const svg = fs.readFileSync(path.join(ROOT, `assets/${name}.svg`), 'utf8');
  const html = `<!doctype html><style>${fontFace}
html,body{margin:0;background:transparent}</style>${svg}`;
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(ROOT, `assets/${name}.png`), omitBackground: true });
  await page.close();
  console.log(`assets/${name}.png`);
}
await browser.close();
