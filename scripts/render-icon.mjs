// Renders assets/icon.svg to assets/icon.png (1024×1024) with headless Chrome, then run
// `npx tauri icon assets/icon.png` to regenerate src-tauri/icons. Env: CHROME_PATH.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const font = path.join(ROOT, 'node_modules/@fontsource/courier-prime/files/courier-prime-latin-700-normal.woff2');
const svg = fs.readFileSync(path.join(ROOT, 'assets/icon.svg'), 'utf8');
const html = `<!doctype html><style>@font-face{font-family:"Courier Prime";font-weight:700;src:url(data:font/woff2;base64,${fs.readFileSync(font).toString('base64')})}
html,body{margin:0;background:transparent}</style>${svg}`;

const chrome = process.env.CHROME_PATH ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, defaultViewport: { width: 1024, height: 1024 } });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(ROOT, 'assets/icon.png'), omitBackground: true });
await browser.close();
console.log('assets/icon.png');
