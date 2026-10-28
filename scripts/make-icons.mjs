// Generates the app icons from the rendered PNGs (run `npm run icon:render` first):
// - src-tauri/icons: Windows .ico and Linux PNGs from assets/icon-square.png (no macOS margin)
// - src-tauri/icons/icon.icns: macOS icon from assets/icon.png (Apple grid with margin)
// - static/favicon.png: 64×64 favicon from assets/icon-square.png
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ICONS = path.join(ROOT, 'src-tauri/icons');
const KEEP = [
  '32x32.png',
  '64x64.png',
  '128x128.png',
  '128x128@2x.png',
  'icon.png',
  'icon.icns',
  'icon.ico',
];

function tauriIcon(input, outDir) {
  const result = spawnSync('npx', ['tauri', 'icon', input, '-o', outDir], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) throw new Error(`tauri icon failed for ${input}`);
}

function pruneUnusedIcons() {
  for (const entry of fs.readdirSync(ICONS)) {
    if (!KEEP.includes(entry)) fs.rmSync(path.join(ICONS, entry), { recursive: true, force: true });
  }
}

tauriIcon(path.join(ROOT, 'assets/icon-square.png'), ICONS);
pruneUnusedIcons();

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'dotmd-icns-'));
tauriIcon(path.join(ROOT, 'assets/icon.png'), scratch);
fs.copyFileSync(path.join(scratch, 'icon.icns'), path.join(ICONS, 'icon.icns'));
fs.rmSync(scratch, { recursive: true, force: true });

fs.mkdirSync(path.join(ROOT, 'static'), { recursive: true });
fs.copyFileSync(path.join(ICONS, '64x64.png'), path.join(ROOT, 'static/favicon.png'));
console.log('src-tauri/icons, static/favicon.png');
