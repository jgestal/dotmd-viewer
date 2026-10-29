import { emit } from '@tauri-apps/api/event';
import { mockWindows } from '@tauri-apps/api/mocks';
import { describe, expect, it, vi } from 'vitest';
import { fakeTranslate } from '../memory';
import { mockBackend, resetMocksAfterEach } from './mockBackend';
import { TauriOpenRequests } from './tauriOpenRequests';
import { tauriDragOut } from './tauriDragOut';
import { tauriPreferencesStore } from './tauriPreferencesStore';
import { tauriRenderer } from './tauriRenderer';
import { tauriWatcher } from './tauriWatcher';
import { tauriWindow } from './tauriWindow';
import { TauriDialogs } from './tauriDialogs';

resetMocksAfterEach();

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('tauriRenderer', () => {
  it('renders through render_markdown and returns html with front matter', async () => {
    const rendered = { html: '<h1>Hi</h1>', frontMatter: 'a: 1' };
    const calls = mockBackend({ render_markdown: () => rendered });
    expect(await tauriRenderer.render('# Hi')).toEqual(rendered);
    expect(calls).toEqual([{ command: 'render_markdown', args: { markdown: '# Hi' } }]);
  });
});

describe('tauriPreferencesStore', () => {
  it('loads whatever the backend has, null included', async () => {
    mockBackend({ load_preferences: () => null });
    expect(await tauriPreferencesStore.load()).toBeNull();
  });

  it('saves the serialised text', async () => {
    const calls = mockBackend({ save_preferences: () => undefined });
    await tauriPreferencesStore.save('{"theme":"dark"}');
    expect(calls).toEqual([
      { command: 'save_preferences', args: { serialised: '{"theme":"dark"}' } },
    ]);
  });

  it('reports a backend failure as an AppError', async () => {
    mockBackend({
      load_preferences: () => Promise.reject({ kind: 'invalidInput', message: 'bad' }),
    });
    await expect(tauriPreferencesStore.load()).rejects.toEqual({
      kind: 'invalidInput',
      message: 'bad',
    });
  });
});

describe('tauriWatcher', () => {
  it('starts and stops watching through watch_file', async () => {
    const calls = mockBackend({ watch_file: () => undefined });
    await tauriWatcher.watch('/a.md');
    await tauriWatcher.watch(null);
    expect(calls.map((call) => call.args)).toEqual([{ path: '/a.md' }, { path: null }]);
  });

  it('delivers file-changed events until unsubscribed', async () => {
    mockBackend({});
    const seen: string[] = [];
    const unsubscribe = tauriWatcher.onChange((path) => seen.push(path));
    await settle();
    await emit('file-changed', { path: '/a.md' });
    unsubscribe();
    await settle();
    await emit('file-changed', { path: '/b.md' });
    expect(seen).toEqual(['/a.md']);
  });
});

describe('tauriWindow', () => {
  it('sets the title and the macOS document state', async () => {
    mockWindows('main');
    const calls = mockBackend({
      'plugin:window|set_title': () => undefined,
      set_document_state: () => undefined,
    });
    await tauriWindow.showDocument('a.md', '/d/a.md', true);
    expect(calls).toEqual([
      // jsdom is not macOS, so the Windows/Linux title format applies.
      {
        command: 'plugin:window|set_title',
        args: { label: 'main', value: '*a.md - DotMD Viewer' },
      },
      { command: 'set_document_state', args: { path: '/d/a.md', edited: true } },
    ]);
  });

  it('toggles full screen from the current state', async () => {
    mockWindows('main');
    const calls = mockBackend({
      'plugin:window|is_fullscreen': () => false,
      'plugin:window|set_fullscreen': () => undefined,
    });
    await tauriWindow.toggleFullscreen();
    expect(calls).toEqual([
      { command: 'plugin:window|is_fullscreen', args: { label: 'main' } },
      { command: 'plugin:window|set_fullscreen', args: { label: 'main', value: true } },
    ]);
  });

  it('shows the window through the window plugin', async () => {
    mockWindows('main');
    const calls = mockBackend({ 'plugin:window|show': () => undefined });
    await tauriWindow.reveal();
    expect(calls).toEqual([{ command: 'plugin:window|show', args: { label: 'main' } }]);
  });

  it('reports a failure to show the window as an AppError', async () => {
    mockWindows('main');
    mockBackend({ 'plugin:window|show': () => Promise.reject('no window') });
    await expect(tauriWindow.reveal()).rejects.toEqual({ kind: 'io', message: 'no window' });
  });
});

describe('TauriOpenRequests', () => {
  it('registers the listener before taking the pending requests', async () => {
    mockBackend({
      take_pending_open: async () => {
        await emit('open-paths', ['/arrived-meanwhile.md']);
        return ['/a.md'];
      },
    });
    const requests = new TauriOpenRequests();
    const listener = vi.fn();
    requests.onOpen(listener);
    expect(await requests.takePending()).toEqual(['/a.md']);
    expect(listener).toHaveBeenCalledWith(['/arrived-meanwhile.md']);
  });

  it('delivers open-paths events to listeners', async () => {
    mockBackend({ take_pending_open: () => [] });
    const requests = new TauriOpenRequests();
    const listener = vi.fn();
    requests.onOpen(listener);
    await requests.takePending();
    await emit('open-paths', ['/x.md', '/y.md']);
    expect(listener).toHaveBeenCalledWith(['/x.md', '/y.md']);
  });
});

describe('TauriDialogs', () => {
  const dialogs = new TauriDialogs(fakeTranslate);
  const filters = [{ name: 'Markdown', extensions: ['md'] }];

  it('opens a single file with the filters', async () => {
    const calls = mockBackend({ 'plugin:dialog|open': () => '/a.md' });
    expect(await dialogs.openFile(filters)).toBe('/a.md');
    expect(calls[0].args).toEqual({
      options: { multiple: false, directory: false, filters },
    });
  });

  it('opens a folder, and answers null when cancelled', async () => {
    const calls = mockBackend({ 'plugin:dialog|open': () => null });
    expect(await dialogs.openFolder()).toBeNull();
    expect(calls[0].args).toEqual({ options: { multiple: false, directory: true } });
  });

  it('asks where to save, starting from the default path', async () => {
    const calls = mockBackend({ 'plugin:dialog|save': () => '/b.md' });
    expect(await dialogs.saveFile('/a.md', filters)).toBe('/b.md');
    expect(calls[0].args).toEqual({ options: { defaultPath: '/a.md', filters } });
  });

  it.each([
    ['dialog.unsaved.save', 'save'],
    ['dialog.unsaved.discard', 'discard'],
    ['dialog.unsaved.cancel', 'cancel'],
  ])('maps the %s button to %s', async (label, choice) => {
    const calls = mockBackend({ 'plugin:dialog|message': () => label });
    expect(await dialogs.askUnsaved('a.md')).toBe(choice);
    expect(calls[0].args).toMatchObject({
      message: 'dialog.unsaved.message {"name":"a.md"}',
      title: 'dialog.unsaved.title',
      kind: 'warning',
      buttons: {
        YesNoCancelCustom: [
          'dialog.unsaved.save',
          'dialog.unsaved.discard',
          'dialog.unsaved.cancel',
        ],
      },
    });
  });

  it('treats a dismissed unsaved dialog as cancel', async () => {
    mockBackend({ 'plugin:dialog|message': () => 'something else' });
    expect(await dialogs.askUnsaved('a.md')).toBe('cancel');
  });

  it('confirms with the given labels', async () => {
    const calls = mockBackend({ 'plugin:dialog|message': () => 'Go' });
    expect(await dialogs.confirm('Title', 'Sure?', 'Go', 'Stop')).toBe(true);
    expect(calls[0].args).toMatchObject({
      message: 'Sure?',
      title: 'Title',
      buttons: { OkCancelCustom: ['Go', 'Stop'] },
    });
  });

  it('declines when the cancel label comes back', async () => {
    mockBackend({ 'plugin:dialog|message': () => 'Stop' });
    expect(await dialogs.confirm('Title', 'Sure?', 'Go', 'Stop')).toBe(false);
  });

  it('shows an alert', async () => {
    const calls = mockBackend({ 'plugin:dialog|message': () => 'Ok' });
    await dialogs.alert('Oops', 'Broken');
    expect(calls[0].args).toMatchObject({ message: 'Broken', title: 'Oops', kind: 'error' });
  });

  it('reports a plugin failure as an AppError', async () => {
    mockBackend({ 'plugin:dialog|open': () => Promise.reject('denied') });
    await expect(dialogs.openFolder()).rejects.toEqual({ kind: 'io', message: 'denied' });
  });
});

describe('tauriDragOut', () => {
  const dragCommand = 'plugin:drag|start_drag';

  it('starts a system drag of the files with the default cursor image', async () => {
    const calls = mockBackend({ drag_icon: () => '/tmp/icon.png', [dragCommand]: () => null });
    await tauriDragOut.start(['/w/a.md', '/w/b.md']);
    expect(calls.map(({ command }) => command)).toEqual(['drag_icon', dragCommand]);
    expect(calls[1].args).toMatchObject({ item: ['/w/a.md', '/w/b.md'], image: '/tmp/icon.png' });
  });

  it('uses the image it is given without asking for the default', async () => {
    const calls = mockBackend({ [dragCommand]: () => null });
    await tauriDragOut.start(['/w/a.md'], '/x/me.png');
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toMatchObject({ image: '/x/me.png' });
  });

  it('reports a refused drag as an app error', async () => {
    mockBackend({ drag_icon: () => '/tmp/icon.png' });
    await expect(tauriDragOut.start(['/w/a.md'])).rejects.toMatchObject({ kind: 'io' });
  });
});
