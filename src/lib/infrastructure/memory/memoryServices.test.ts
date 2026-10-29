import { describe, expect, it, vi } from 'vitest';
import { createMemoryServices } from '.';
import { fakeTranslate } from './fakeTranslate';
import { MemoryContextMenu } from './memoryContextMenu';
import { MemoryDialogs } from './memoryDialogs';
import { MemoryNotifier } from './memoryNotifier';
import { MemoryDragOut } from './memoryDragOut';
import { MemoryAppInfo } from './memoryAppInfo';
import { MemoryOpener } from './memoryOpener';
import { MemoryOpenRequests } from './memoryOpenRequests';
import { MemoryPreferencesStore } from './memoryPreferencesStore';
import { MemoryRenderer } from './memoryRenderer';
import { MemoryWindow } from './memoryWindow';

describe('MemoryDialogs', () => {
  it('returns scripted answers in order and records what it was asked', async () => {
    const dialogs = new MemoryDialogs();
    const filters = [{ name: 'Markdown', extensions: ['md'] }];
    dialogs.answerOpenFile('/a.md');
    dialogs.answerOpenFile(null);
    dialogs.answerOpenFolder('/d');
    dialogs.answerSaveFile('/b.md');
    dialogs.answerAskUnsaved('discard');
    dialogs.answerConfirm(true);
    dialogs.answerAlert();

    expect(await dialogs.openFile(filters)).toBe('/a.md');
    expect(await dialogs.openFile(filters)).toBeNull();
    expect(await dialogs.openFolder()).toBe('/d');
    expect(await dialogs.saveFile('/x.md', filters)).toBe('/b.md');
    expect(await dialogs.askUnsaved('x.md')).toBe('discard');
    expect(await dialogs.confirm('T', 'M', 'OK', 'No')).toBe(true);
    await dialogs.alert('T', 'M');

    expect(dialogs.calls).toEqual([
      { method: 'openFile', args: [filters] },
      { method: 'openFile', args: [filters] },
      { method: 'openFolder', args: [] },
      { method: 'saveFile', args: ['/x.md', filters] },
      { method: 'askUnsaved', args: ['x.md'] },
      { method: 'confirm', args: ['T', 'M', 'OK', 'No'] },
      { method: 'alert', args: ['T', 'M'] },
    ]);
  });

  it('throws a clear error when asked without a scripted answer', async () => {
    const dialogs = new MemoryDialogs();
    await expect(dialogs.askUnsaved('x.md')).rejects.toThrow(
      'MemoryDialogs.askUnsaved was called without a scripted answer',
    );
    await expect(dialogs.alert('T', 'M')).rejects.toThrow('MemoryDialogs.alert');
  });

  it('keeps the queues of different dialogs apart', async () => {
    const dialogs = new MemoryDialogs();
    dialogs.answerConfirm(false);
    await expect(dialogs.openFolder()).rejects.toThrow('openFolder');
    expect(await dialogs.confirm('T', 'M', 'OK', 'No')).toBe(false);
  });
});

describe('MemoryWatcher', () => {
  it('notifies listeners when the watched path is written externally', async () => {
    const { fs, watcher } = createMemoryServices();
    fs.seedFile('/d/a.md', 'x');
    const listener = vi.fn();
    watcher.onChange(listener);
    await watcher.watch('/d/a.md');
    fs.simulateExternalWrite('\\d\\a.md', 'y');
    expect(listener).toHaveBeenCalledExactlyOnceWith('/d/a.md');
    expect(watcher.watched).toBe('/d/a.md');
  });

  it('ignores other paths, stopped watching and unsubscribed listeners', async () => {
    const { fs, watcher } = createMemoryServices();
    fs.seedFile('/d/a.md', 'x');
    fs.seedFile('/d/b.md', 'x');
    const listener = vi.fn();
    const unsubscribe = watcher.onChange(listener);

    fs.simulateExternalWrite('/d/a.md', 'y');
    await watcher.watch('/d/a.md');
    fs.simulateExternalWrite('/d/b.md', 'y');
    await watcher.watch(null);
    fs.simulateExternalWrite('/d/a.md', 'z');
    await watcher.watch('/d/a.md');
    unsubscribe();
    fs.simulateExternalWrite('/d/a.md', 'w');

    expect(listener).not.toHaveBeenCalled();
    expect(watcher.watchCalls).toEqual(['/d/a.md', null, '/d/a.md']);
  });
});

describe('MemoryWindow', () => {
  it('has no current state until a document is shown, then exposes the last call', async () => {
    const window = new MemoryWindow();
    expect(window.current).toBeNull();
    await window.showDocument('a.md', '/a.md', false);
    await window.showDocument('a.md', '/a.md', true);
    expect(window.current).toEqual({ title: 'a.md', path: '/a.md', edited: true });
    expect(window.calls).toHaveLength(2);
  });

  it('counts reveals without showing anything', async () => {
    const window = new MemoryWindow();
    expect(window.reveals).toBe(0);
    await window.reveal();
    await window.reveal();
    expect(window.reveals).toBe(2);
    expect(window.current).toBeNull();
  });
});

describe('MemoryWindow closing', () => {
  it('closes and quits when every close handler agrees', async () => {
    const window = new MemoryWindow();
    window.onCloseRequested(async () => true);
    expect(await window.requestClose()).toBe(true);
    expect(window.quitCalled).toBe(true);
  });

  it('stays open when a close handler refuses', async () => {
    const window = new MemoryWindow();
    window.onCloseRequested(async () => true);
    window.onCloseRequested(async () => false);
    expect(await window.requestClose()).toBe(false);
    expect(window.quitCalled).toBe(false);
  });

  it('stops asking a handler once it is removed', async () => {
    const window = new MemoryWindow();
    const remove = window.onCloseRequested(async () => false);
    remove();
    expect(await window.requestClose()).toBe(true);
  });

  it('delivers quit requests until the handler is removed, and quits on demand', async () => {
    const window = new MemoryWindow();
    const handler = vi.fn();
    const remove = window.onQuitRequested(handler);
    window.requestQuit();
    remove();
    window.requestQuit();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(window.quitCalled).toBe(false);
    await window.quit();
    expect(window.quitCalled).toBe(true);
  });
});

describe('MemoryPreferencesStore', () => {
  it('loads the raw value it was given', async () => {
    expect(await new MemoryPreferencesStore({ zoom: 2 }).load()).toEqual({ zoom: 2 });
    expect(await new MemoryPreferencesStore().load()).toBeNull();
  });

  it('records saved text and loads it back parsed', async () => {
    const store = new MemoryPreferencesStore();
    await store.save('{"zoom":1.5}');
    expect(store.saved).toEqual(['{"zoom":1.5}']);
    expect(await store.load()).toEqual({ zoom: 1.5 });
  });

  it('loads text that is not JSON as it is', async () => {
    const store = new MemoryPreferencesStore();
    await store.save('not json');
    expect(await store.load()).toBe('not json');
  });
});

describe('MemoryOpenRequests', () => {
  it('queues requests while nobody listens and hands them over once', async () => {
    const requests = new MemoryOpenRequests();
    requests.emit(['/a.md']);
    requests.emit(['/b.md', '/c.md']);
    expect(await requests.takePending()).toEqual(['/a.md', '/b.md', '/c.md']);
    expect(await requests.takePending()).toEqual([]);
  });

  it('delivers to listeners instead of queueing, until they unsubscribe', async () => {
    const requests = new MemoryOpenRequests();
    const listener = vi.fn();
    const unsubscribe = requests.onOpen(listener);
    requests.emit(['/a.md']);
    expect(listener).toHaveBeenCalledExactlyOnceWith(['/a.md']);
    expect(requests.pending).toEqual([]);

    unsubscribe();
    requests.emit(['/b.md']);
    expect(listener).toHaveBeenCalledOnce();
    expect(await requests.takePending()).toEqual(['/b.md']);
  });
});

describe('MemoryNotifier', () => {
  it('keeps infos and errors apart', () => {
    const notifier = new MemoryNotifier();
    notifier.info('saved');
    notifier.error('failed');
    expect(notifier.infos).toEqual(['saved']);
    expect(notifier.errors).toEqual(['failed']);
  });
});

describe('MemoryRenderer', () => {
  it('wraps the escaped text in a paragraph', async () => {
    const renderer = new MemoryRenderer();
    expect(await renderer.render('a < b & c > d')).toEqual({
      html: '<p>a &lt; b &amp; c &gt; d</p>',
      frontMatter: null,
    });
    expect(renderer.rendered).toEqual(['a < b & c > d']);
  });

  it('splits the front matter off the rendered body', async () => {
    const rendered = await new MemoryRenderer().render('---\ntitle: Hi\n---\nBody');
    expect(rendered).toEqual({ html: '<p>Body</p>', frontMatter: 'title: Hi' });
  });
});

describe('MemoryOpener', () => {
  it('records the addresses it was asked to open', async () => {
    const opener = new MemoryOpener();
    await opener.openExternal('https://example.com');
    await opener.openExternal('mailto:a@b.c');
    expect(opener.opened).toEqual(['https://example.com', 'mailto:a@b.c']);
  });
});

describe('MemoryDragOut', () => {
  it('records the drags it was asked to start', async () => {
    const dragOut = new MemoryDragOut();
    await dragOut.start(['/w/a.md']);
    await dragOut.start(['/w/b.md', '/w/c.md'], '/icon.png');
    expect(dragOut.started).toEqual([
      { paths: ['/w/a.md'], iconPath: undefined },
      { paths: ['/w/b.md', '/w/c.md'], iconPath: '/icon.png' },
    ]);
  });
});

describe('fakeTranslate', () => {
  it('returns the key alone without variables', () => {
    expect(fakeTranslate('menu.open')).toBe('menu.open');
  });

  it('appends the variables as JSON', () => {
    expect(fakeTranslate('greeting', { name: 'Ada', n: 2 })).toBe('greeting {"name":"Ada","n":2}');
  });
});

describe('createMemoryServices', () => {
  it('builds independent sets of doubles', () => {
    const first = createMemoryServices();
    const second = createMemoryServices();
    first.notifier.info('x');
    expect(second.notifier.infos).toEqual([]);
    expect(first.translate).toBe(fakeTranslate);
  });
});

describe('MemoryContextMenu', () => {
  it('answers with the scripted choices, then null, and records the items', async () => {
    const menu = new MemoryContextMenu();
    const items = [{ id: 'open', label: 'Open' }];
    menu.answer('open');
    expect(await menu.show(items)).toBe('open');
    expect(await menu.show(items)).toBeNull();
    expect(menu.shown).toEqual([items, items]);
  });
});

describe('MemoryAppInfo', () => {
  it('answers the version in package.json', async () => {
    expect(await new MemoryAppInfo().version()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
