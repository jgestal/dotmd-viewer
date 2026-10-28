// The dependency rule of the layered architecture, enforced:
// domain -> application -> ports -> infrastructure (tauri / memory) -> presentation.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  checkApplication,
  checkDomain,
  checkPorts,
  checkTauriIsolation,
  importSpecifiers,
  resolveImport,
  type SourceFile,
} from './architecture-rules';

const SRC = path.resolve(import.meta.dirname, '..', '..');
const SOURCE_FILE = /\.(ts|js|svelte)$/;
const TEST_CODE = /(^|\/)__tests__\/|\.test\.ts$/;

const listFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });

const loadSources = (): SourceFile[] =>
  listFiles(SRC)
    .map((fullPath) => path.relative(SRC, fullPath).split(path.sep).join('/'))
    .filter((relativePath) => SOURCE_FILE.test(relativePath) && !TEST_CODE.test(relativePath))
    .map((relativePath) => ({
      path: relativePath,
      content: fs.readFileSync(path.join(SRC, relativePath), 'utf8'),
    }));

const file = (filePath: string, content: string): SourceFile => ({ path: filePath, content });

describe('architecture of the real source tree', () => {
  const sources = loadSources();

  it('domain imports nothing outside domain', () => expect(checkDomain(sources)).toEqual([]));
  it('application imports only domain and ports', () =>
    expect(checkApplication(sources)).toEqual([]));
  it('ports contain only types and import only domain and ports', () =>
    expect(checkPorts(sources)).toEqual([]));
  it('only infrastructure/tauri touches @tauri-apps or invoke', () =>
    expect(checkTauriIsolation(sources)).toEqual([]));
});

describe('import parsing', () => {
  it('finds static, side-effect, re-export and dynamic imports but ignores comments', () => {
    const source = `
      import a from './a';
      import type { B } from "$lib/b";
      import './side-effect';
      export * from '../c';
      const d = await import('./d');
      // import x from './commented';
      /* import y from './block'; */
    `;
    expect(importSpecifiers(source)).toEqual(['./a', '$lib/b', './side-effect', '../c', './d']);
  });

  it('resolves $lib and relative specifiers against src/', () => {
    expect(resolveImport('lib/domain/a.ts', '$lib/ports/p')).toBe('lib/ports/p');
    expect(resolveImport('lib/domain/a.ts', './b')).toBe('lib/domain/b');
    expect(resolveImport('lib/domain/a.ts', '../ports/p')).toBe('lib/ports/p');
    expect(resolveImport('lib/domain/a.ts', 'svelte')).toBe('svelte');
  });
});

describe('rule checker catches violations in fixtures', () => {
  it('domain: allows itself, rejects other layers and packages', () => {
    const ok = file(
      'lib/domain/a.ts',
      `import { b } from './b'; import { c } from '$lib/domain/c';`,
    );
    expect(checkDomain([ok])).toEqual([]);
    expect(checkDomain([file('lib/domain/a.ts', `import { p } from '../ports/p';`)])).toHaveLength(
      1,
    );
    expect(
      checkDomain([file('lib/domain/a.ts', `import { p } from '$lib/application/use';`)]),
    ).toHaveLength(1);
    expect(checkDomain([file('lib/domain/a.ts', `import fs from 'node:fs';`)])).toHaveLength(1);
  });

  it('application: allows domain, ports and itself, rejects everything else', () => {
    const ok = file(
      'lib/application/use.ts',
      `import { d } from '../domain/d'; import type { P } from '$lib/ports/p'; import { u } from './u';`,
    );
    expect(checkApplication([ok])).toEqual([]);
    expect(
      checkApplication([
        file('lib/application/use.ts', `import { i } from '../infrastructure/memory/i';`),
      ]),
    ).toHaveLength(1);
    expect(
      checkApplication([
        file('lib/application/use.ts', `import { v } from '$lib/presentation/v';`),
      ]),
    ).toHaveLength(1);
    expect(
      checkApplication([file('lib/application/use.ts', `import { s } from 'svelte';`)]),
    ).toHaveLength(1);
  });

  it('ports: allows type declarations, rejects runtime code and outside imports', () => {
    const ok = file(
      'lib/ports/p.ts',
      `import type { D } from '../domain/d';\nexport interface P { get(): D }\nexport type Q = P;\n// const note = 1;`,
    );
    expect(checkPorts([ok])).toEqual([]);
    for (const runtime of [
      'export const x = 1;',
      'export function f() {}',
      'export class C {}',
      'export enum E { A }',
      'export default 1;',
    ]) {
      expect(checkPorts([file('lib/ports/p.ts', runtime)]), runtime).toHaveLength(1);
    }
    expect(
      checkPorts([file('lib/ports/p.ts', `import type { A } from '../application/a';`)]),
    ).toHaveLength(1);
  });

  it('tauri: only infrastructure/tauri may import @tauri-apps or call invoke', () => {
    const inside = file(
      'lib/infrastructure/tauri/fs.ts',
      `import { invoke } from '@tauri-apps/api/core'; invoke('read');`,
    );
    expect(checkTauriIsolation([inside])).toEqual([]);

    const importOutside = file(
      'lib/presentation/App.svelte',
      `import { open } from '@tauri-apps/plugin-dialog';`,
    );
    const invokeOutside = file('lib/infrastructure/memory/m.ts', `await invoke<string>('read');`);
    const routeOutside = file(
      'routes/+page.ts',
      `import { getCurrentWindow } from '@tauri-apps/api/window';`,
    );
    expect(checkTauriIsolation([importOutside])).toHaveLength(1);
    expect(checkTauriIsolation([invokeOutside])).toHaveLength(1);
    expect(checkTauriIsolation([routeOutside])).toHaveLength(1);
  });
});
