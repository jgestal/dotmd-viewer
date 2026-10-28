import { mockWindows } from '@tauri-apps/api/mocks';
import { describe, expect, it } from 'vitest';
import { createContainer } from './container';
import { fakeTranslate, MemoryNotifier } from './infrastructure/memory';
import { mockBackend, resetMocksAfterEach } from './infrastructure/tauri/mockBackend';
import { isTauri } from './isTauri';

resetMocksAfterEach();

const options = () => ({ notifier: new MemoryNotifier(), t: fakeTranslate });

describe('isTauri', () => {
  it('is false in a plain browser', () => {
    expect(isTauri()).toBe(false);
  });

  it('is true when the Tauri internals are present', () => {
    Object.assign(window, { __TAURI_INTERNALS__: {} });
    expect(isTauri()).toBe(true);
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  });
});

describe('createContainer', () => {
  it('defaults to the memory adapters outside Tauri', async () => {
    const { preferences, renderer } = createContainer(options());
    expect((await preferences.load()).theme).toBeDefined();
    expect((await renderer.render('# a')).html).toContain('a');
  });

  it('wires the Tauri adapters to the Rust commands', async () => {
    mockWindows('main');
    const rendered = { html: '<p>x</p>', frontMatter: null };
    const calls = mockBackend({
      render_markdown: () => rendered,
      read_file: () => ({ content: '# Hi', encoding: 'utf-8', hasBom: false }),
      watch_file: () => undefined,
      'plugin:window|set_title': () => undefined,
      set_document_state: () => undefined,
    });
    const { documents, renderer } = createContainer({ ...options(), mode: 'tauri' });
    expect(await renderer.render('x')).toEqual(rendered);
    const opened = await documents.open({ doc: null }, '/a.md');
    expect(opened?.openedPath).toBe('/a.md');
    expect(calls.map((call) => call.command)).toContain('read_file');
  });
});
