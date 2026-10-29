import { spawn, type ChildProcess } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binary = path.join(
  process.env.CARGO_TARGET_DIR ?? path.join(root, 'src-tauri', 'target'),
  'debug',
  os.platform() === 'win32' ? 'dotmd-viewer.exe' : 'dotmd-viewer',
);
const screenshots = path.join(root, 'e2e', 'screenshots');
const fixtures = path.join(root, 'e2e', 'fixtures');

// The document scenario edits and saves, so it runs on a copy and the fixture stays pristine.
const workDir = path.join(os.tmpdir(), 'dotmd-e2e');
const documentCopy = path.join(workDir, 'sample.md');
process.env.E2E_DOCUMENT = documentCopy;

// The app takes its document or folder from the command line, so each scenario that needs a
// different one is its own capability, pinned to its spec file.
const launching = (specs: string[], argument: string) =>
  ({
    'wdio:specs': specs,
    'tauri:options': { application: binary, args: [argument] },
  }) as WebdriverIO.Capabilities;

let tauriDriver: ChildProcess | undefined;

const stopDriver = () => tauriDriver?.kill();

export const config: WebdriverIO.Config = {
  hostname: '127.0.0.1',
  port: 4444,
  specs: ['./specs/**/*.e2e.ts'],
  // One app instance at a time: the app is single-instance.
  maxInstances: 1,
  capabilities: [
    launching(['./specs/document.e2e.ts'], documentCopy),
    launching(['./specs/folder.e2e.ts'], path.join(fixtures, 'folder')),
  ],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { ui: 'bdd', timeout: 60_000 },
  waitforTimeout: 15_000,
  connectionRetryTimeout: 90_000,
  connectionRetryCount: 0,

  onPrepare: () => {
    mkdirSync(workDir, { recursive: true });
    mkdirSync(screenshots, { recursive: true });
    copyFileSync(path.join(fixtures, 'sample.md'), documentCopy);
  },

  // tauri-driver proxies WebDriver to WebKitWebDriver (Linux) or msedgedriver (Windows).
  beforeSession: () => {
    const nativeDriver = process.env.NATIVE_WEBDRIVER;
    tauriDriver = spawn(
      path.join(os.homedir(), '.cargo', 'bin', 'tauri-driver'),
      nativeDriver ? ['--native-driver', nativeDriver] : [],
      { stdio: [null, process.stdout, process.stderr] },
    );
  },

  afterSession: stopDriver,

  afterTest: async (test, _context, { passed }) => {
    if (passed) return;
    const name = test.title.replace(/\W+/g, '-');
    await browser.saveScreenshot(path.join(screenshots, `${name}.png`));
  },
};

process.on('exit', stopDriver);
