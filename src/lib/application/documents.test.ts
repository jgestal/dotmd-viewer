import { describe, expect, it } from 'vitest';
import { appError } from '../domain/errors';
import { isDirty } from '../domain/document';
import { createMemoryServices } from '../infrastructure/memory';
import { createDocuments, type DocumentState } from './documents';

const EMPTY: DocumentState = { doc: null };

const setup = () => {
  const services = createMemoryServices();
  const documents = createDocuments({
    fs: services.fs,
    dialogs: services.dialogs,
    window: services.window,
    watcher: services.watcher,
    notifier: services.notifier,
    t: services.translate,
  });
  services.fs.seedFile('/notes/a.md', '# A\n');
  services.fs.seedFile('/notes/b.md', '# B\n');
  const openFile = async (path: string): Promise<DocumentState> => {
    const result = await documents.open(EMPTY, path);
    if (result === null) throw new Error('open failed');
    return result.state;
  };
  return { ...services, documents, openFile };
};

describe('open', () => {
  it('reads the file, watches it, shows it and reports the opened path', async () => {
    const { documents, window, watcher } = setup();
    const result = await documents.open(EMPTY, '/notes/a.md');
    expect(result?.openedPath).toBe('/notes/a.md');
    expect(result?.state.doc?.content).toBe('# A\n');
    expect(watcher.watched).toBe('/notes/a.md');
    expect(window.current).toEqual({ title: 'a.md', path: '/notes/a.md', edited: false });
  });

  it('keeps the previous state and tells the user when the file cannot be read', async () => {
    const { documents, fs, notifier, openFile } = setup();
    const state = await openFile('/notes/a.md');
    fs.failNext('readText', appError('permissionDenied', 'Denied'));
    expect(await documents.open(state, '/notes/b.md')).toBeNull();
    expect(notifier.errors).toEqual(['error.open {"name":"b.md","message":"Denied"}']);
  });

  it('does nothing when the path is already open', async () => {
    const { documents, fs, openFile } = setup();
    const state = await openFile('/notes/a.md');
    const reads = fs.calls.length;
    expect(await documents.open(state, '/notes//a.md')).toBeNull();
    expect(fs.calls).toHaveLength(reads);
  });

  it('opens over an untitled document that has a path of null', async () => {
    const { documents } = setup();
    const fresh = await documents.newDocument(EMPTY);
    const result = await documents.open(fresh as DocumentState, '/notes/a.md');
    expect(result?.state.doc?.path).toBe('/notes/a.md');
  });

  it('preserves CRLF, encoding and BOM from the file', async () => {
    const { documents, fs } = setup();
    fs.seedFile('/notes/w.md', 'a\r\nb', { encoding: 'utf-16le', hasBom: true });
    const doc = (await documents.open(EMPTY, '/notes/w.md'))?.state.doc;
    expect(doc).toMatchObject({
      content: 'a\nb',
      lineEnding: 'crlf',
      encoding: 'utf-16le',
      hasBom: true,
    });
  });
});

describe('open with unsaved changes', () => {
  const dirty = async (ctx: ReturnType<typeof setup>) =>
    ctx.documents.edit(await ctx.openFile('/notes/a.md'), 'changed');

  it('saves first when the user chooses save', async () => {
    const ctx = setup();
    const state = await dirty(ctx);
    ctx.dialogs.answerAskUnsaved('save');
    const result = await ctx.documents.open(state, '/notes/b.md');
    expect(result?.state.doc?.path).toBe('/notes/b.md');
    expect((await ctx.fs.readText('/notes/a.md')).content).toBe('changed');
    expect(ctx.dialogs.calls[0]).toEqual({ method: 'askUnsaved', args: ['a.md'] });
  });

  it('opens without saving when the user chooses discard', async () => {
    const ctx = setup();
    const state = await dirty(ctx);
    ctx.dialogs.answerAskUnsaved('discard');
    const result = await ctx.documents.open(state, '/notes/b.md');
    expect(result?.state.doc?.path).toBe('/notes/b.md');
    expect((await ctx.fs.readText('/notes/a.md')).content).toBe('# A\n');
  });

  it('stays on the document when the user cancels', async () => {
    const ctx = setup();
    const state = await dirty(ctx);
    ctx.dialogs.answerAskUnsaved('cancel');
    expect(await ctx.documents.open(state, '/notes/b.md')).toBeNull();
    expect(ctx.watcher.watched).toBe('/notes/a.md');
  });

  it('stays on the document when saving it fails', async () => {
    const ctx = setup();
    const state = await dirty(ctx);
    ctx.dialogs.answerAskUnsaved('save');
    ctx.fs.failNext('writeText', appError('io', 'Disk full'));
    expect(await ctx.documents.open(state, '/notes/b.md')).toBeNull();
    expect(ctx.notifier.errors).toEqual(['error.save {"name":"a.md","message":"Disk full"}']);
  });

  it('names an untitled document with the translated untitled name', async () => {
    const ctx = setup();
    const fresh = await ctx.documents.edit(
      (await ctx.documents.newDocument(EMPTY)) as DocumentState,
      'x',
    );
    ctx.dialogs.answerAskUnsaved('cancel');
    await ctx.documents.open(fresh, '/notes/a.md');
    expect(ctx.dialogs.calls[0]?.args).toEqual(['document.untitled']);
  });
});

describe('openWithDialog', () => {
  it('asks for a Markdown file and opens it', async () => {
    const { documents, dialogs } = setup();
    dialogs.answerOpenFile('/notes/a.md');
    const result = await documents.openWithDialog(EMPTY);
    expect(result?.openedPath).toBe('/notes/a.md');
    expect(dialogs.calls[0]).toEqual({
      method: 'openFile',
      args: [[{ name: 'filter.markdown', extensions: ['md', 'markdown', 'txt'] }]],
    });
  });

  it('does nothing when the dialog is cancelled', async () => {
    const { documents, dialogs } = setup();
    dialogs.answerOpenFile(null);
    expect(await documents.openWithDialog(EMPTY)).toBeNull();
  });
});

describe('newDocument', () => {
  it('starts an untitled document and stops watching', async () => {
    const { documents, openFile, watcher, window } = setup();
    const state = await openFile('/notes/a.md');
    const result = await documents.newDocument(state);
    expect(result?.doc).toMatchObject({ path: null, content: '' });
    expect(watcher.watched).toBeNull();
    expect(window.current).toEqual({ title: 'document.untitled', path: null, edited: false });
  });

  it('is cancelled by the user when there are unsaved changes', async () => {
    const { documents, openFile, dialogs } = setup();
    const state = await documents.edit(await openFile('/notes/a.md'), 'x');
    dialogs.answerAskUnsaved('cancel');
    expect(await documents.newDocument(state)).toBeNull();
  });
});

describe('save', () => {
  it('does nothing without a document', async () => {
    const { documents, fs } = setup();
    expect(await documents.save(EMPTY)).toBeNull();
    expect(await documents.saveAs(EMPTY)).toBeNull();
    expect(fs.calls).toHaveLength(0);
  });

  it('writes the content back with its CRLF, encoding and BOM and clears the dirty flag', async () => {
    const { documents, fs, window } = setup();
    fs.seedFile('/notes/w.md', 'a\r\nb', { encoding: 'utf-16le', hasBom: true });
    const state = (await documents.open(EMPTY, '/notes/w.md'))?.state as DocumentState;
    const edited = await documents.edit(state, 'a\nb\nc');
    const saved = await documents.save(edited);
    expect(await fs.readText('/notes/w.md')).toEqual({
      content: 'a\r\nb\r\nc',
      encoding: 'utf-16le',
      hasBom: true,
    });
    expect(saved?.doc && isDirty(saved.doc)).toBe(false);
    expect(window.current).toEqual({ title: 'w.md', path: '/notes/w.md', edited: false });
  });

  it('notifies and leaves the document dirty when the write fails', async () => {
    const { documents, fs, notifier, openFile } = setup();
    const edited = await documents.edit(await openFile('/notes/a.md'), 'x');
    fs.failNext('writeText', appError('permissionDenied', 'Read-only'));
    expect(await documents.save(edited)).toBeNull();
    expect(notifier.errors).toEqual(['error.save {"name":"a.md","message":"Read-only"}']);
    expect(edited.doc && isDirty(edited.doc)).toBe(true);
  });

  it('turns an unexpected failure into a message', async () => {
    const { documents, fs, notifier, openFile } = setup();
    const edited = await documents.edit(await openFile('/notes/a.md'), 'x');
    fs.failNext('writeText', new Error('boom') as never);
    await documents.save(edited);
    expect(notifier.errors).toEqual(['error.save {"name":"a.md","message":"boom"}']);
  });

  it('asks where to save an untitled document', async () => {
    const { documents, dialogs, fs, watcher } = setup();
    dialogs.answerSaveFile('/notes/new.md');
    const fresh = await documents.edit((await documents.newDocument(EMPTY)) as DocumentState, 'hi');
    const saved = await documents.save(fresh);
    expect(saved?.doc?.path).toBe('/notes/new.md');
    expect((await fs.readText('/notes/new.md')).content).toBe('hi');
    expect(watcher.watched).toBe('/notes/new.md');
  });
});

describe('saveAs', () => {
  it('proposes the current path, keeps a typed extension and re-watches the new path', async () => {
    const { documents, dialogs, fs, watcher, openFile } = setup();
    const state = await openFile('/notes/a.md');
    dialogs.answerSaveFile('/notes/copy.txt');
    const saved = await documents.saveAs(state);
    expect(dialogs.calls[0]?.args[0]).toBe('/notes/a.md');
    expect(saved?.doc?.path).toBe('/notes/copy.txt');
    expect((await fs.readText('/notes/copy.txt')).content).toBe('# A\n');
    expect(watcher.watched).toBe('/notes/copy.txt');
  });

  it('proposes the untitled name with .md for a new document', async () => {
    const { documents, dialogs } = setup();
    dialogs.answerSaveFile(null);
    await documents.saveAs((await documents.newDocument(EMPTY)) as DocumentState);
    expect(dialogs.calls[0]?.args[0]).toBe('document.untitled.md');
  });

  it('adds .md when the user typed no extension', async () => {
    const { documents, dialogs, openFile } = setup();
    dialogs.answerSaveFile('/notes/plain');
    const saved = await documents.saveAs(await openFile('/notes/a.md'));
    expect(saved?.doc?.path).toBe('/notes/plain.md');
  });

  it('adds .md to a dot file, whose leading dot is not an extension', async () => {
    const { documents, dialogs, openFile } = setup();
    dialogs.answerSaveFile('/notes/.hidden');
    const saved = await documents.saveAs(await openFile('/notes/a.md'));
    expect(saved?.doc?.path).toBe('/notes/.hidden.md');
  });

  it('does nothing when the dialog is cancelled', async () => {
    const { documents, dialogs, fs, openFile } = setup();
    dialogs.answerSaveFile(null);
    const state = await openFile('/notes/a.md');
    const calls = fs.calls.length;
    expect(await documents.saveAs(state)).toBeNull();
    expect(fs.calls).toHaveLength(calls);
  });

  it('notifies and keeps the old path when the write fails', async () => {
    const { documents, dialogs, fs, notifier, openFile } = setup();
    dialogs.answerSaveFile('/missing/x.md');
    expect(await documents.saveAs(await openFile('/notes/a.md'))).toBeNull();
    expect(notifier.errors).toHaveLength(1);
    expect(fs.calls.at(-1)?.method).toBe('writeText');
  });
});

describe('edit', () => {
  it('returns the same empty state without a document', async () => {
    const { documents, window } = setup();
    expect(await documents.edit(EMPTY, 'x')).toBe(EMPTY);
    expect(window.calls).toHaveLength(0);
  });

  it('updates the window only when the dirty flag changes', async () => {
    const { documents, window, openFile } = setup();
    const state = await openFile('/notes/a.md');
    const shown = window.calls.length;
    const first = await documents.edit(state, 'one');
    expect(window.current?.edited).toBe(true);
    const second = await documents.edit(first, 'two');
    expect(window.calls).toHaveLength(shown + 1);
    await documents.edit(second, '# A\n');
    expect(window.current?.edited).toBe(false);
    expect(window.calls).toHaveLength(shown + 2);
  });
});

describe('close and confirmQuit', () => {
  it('closes a clean document', async () => {
    const { documents, openFile, watcher, window } = setup();
    expect(await documents.close(await openFile('/notes/a.md'))).toEqual({ doc: null });
    expect(watcher.watched).toBeNull();
    expect(window.current).toEqual({ title: 'app.name', path: null, edited: false });
  });

  it('stays open when the user cancels', async () => {
    const { documents, openFile, dialogs } = setup();
    const state = await documents.edit(await openFile('/notes/a.md'), 'x');
    dialogs.answerAskUnsaved('cancel');
    expect(await documents.close(state)).toBeNull();
  });

  it('confirms quitting when there is nothing to lose', async () => {
    const { documents, dialogs } = setup();
    expect(await documents.confirmQuit(EMPTY)).toBe(true);
    expect(dialogs.calls).toHaveLength(0);
  });

  it.each([
    ['save', true],
    ['discard', true],
    ['cancel', false],
  ] as const)('answers %s to the unsaved prompt with %s', async (choice, expected) => {
    const { documents, openFile, dialogs } = setup();
    const state = await documents.edit(await openFile('/notes/a.md'), 'x');
    dialogs.answerAskUnsaved(choice);
    expect(await documents.confirmQuit(state)).toBe(expected);
  });
});

describe('externalChange', () => {
  it('ignores other paths and an empty state', async () => {
    const { documents, openFile } = setup();
    expect(await documents.externalChange(EMPTY, '/notes/a.md')).toBeNull();
    const state = await openFile('/notes/a.md');
    expect(await documents.externalChange(state, '/notes/b.md')).toBeNull();
    const fresh = (await documents.newDocument(state)) as DocumentState;
    expect(await documents.externalChange(fresh, '/notes/a.md')).toBeNull();
  });

  it('reloads a clean document through the watcher', async () => {
    const { documents, fs, watcher, openFile } = setup();
    let state = await openFile('/notes/a.md');
    watcher.onChange((path) => {
      void documents.externalChange(state, path).then((next) => (state = next ?? state));
    });
    fs.simulateExternalWrite('/notes/a.md', 'new text');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(state.doc?.content).toBe('new text');
  });

  it('ignores the echo of our own save, even when it fires twice', async () => {
    const { documents, fs, notifier, dialogs, openFile } = setup();
    const edited = await documents.edit(await openFile('/notes/a.md'), 'mine');
    const saved = (await documents.save(edited)) as DocumentState;
    const again = await documents.edit(saved, 'mine and more');
    expect(await documents.externalChange(saved, '/notes/a.md')).toBeNull();
    expect(await documents.externalChange(again, '/notes/a.md')).toBeNull();
    expect(dialogs.calls).toHaveLength(0);
    expect(notifier.errors).toEqual([]);
    expect(fs.calls.filter((call) => call.method === 'readText')).toHaveLength(3);
  });

  it('does not treat an unrelated write to another path as our echo', async () => {
    const { documents, fs, openFile, dialogs } = setup();
    const saved = (await documents.save(
      await documents.edit(await openFile('/notes/a.md'), 'mine'),
    )) as DocumentState;
    dialogs.answerSaveFile('/notes/c.md');
    const moved = (await documents.saveAs(saved)) as DocumentState;
    fs.simulateExternalWrite('/notes/c.md', 'elsewhere');
    expect((await documents.externalChange(moved, '/notes/c.md'))?.doc?.content).toBe('elsewhere');
  });

  it('keeps unsaved edits when the file did not really change', async () => {
    const { documents, dialogs, openFile } = setup();
    const state = await documents.edit(await openFile('/notes/a.md'), 'mine');
    expect(await documents.externalChange(state, '/notes/a.md')).toBeNull();
    expect(dialogs.calls).toHaveLength(0);
  });

  describe('conflict with unsaved edits', () => {
    const conflict = async () => {
      const ctx = setup();
      const state = await ctx.documents.edit(await ctx.openFile('/notes/a.md'), 'mine');
      ctx.fs.simulateExternalWrite('/notes/a.md', 'theirs');
      return { ...ctx, state };
    };

    it('keeps my version when the user chooses keep mine', async () => {
      const { documents, dialogs, state } = await conflict();
      dialogs.answerConfirm(true);
      expect(await documents.externalChange(state, '/notes/a.md')).toBeNull();
      expect(dialogs.calls[0]).toEqual({
        method: 'confirm',
        args: [
          'reload.conflict.title',
          'reload.conflict.message {"name":"a.md"}',
          'reload.keepMine',
          'reload.useDisk',
        ],
      });
    });

    it('replaces the document with the disk version when the user chooses use disk', async () => {
      const { documents, dialogs, state, window } = await conflict();
      dialogs.answerConfirm(false);
      const next = await documents.externalChange(state, '/notes/a.md');
      expect(next?.doc?.content).toBe('theirs');
      expect(next?.doc && isDirty(next.doc)).toBe(false);
      expect(window.current).toEqual({ title: 'a.md', path: '/notes/a.md', edited: false });
    });
  });

  describe('when the file cannot be read', () => {
    it('tells the user the file was deleted and keeps the text as unsaved', async () => {
      const { documents, fs, notifier, window, openFile } = setup();
      const state = await openFile('/notes/a.md');
      await fs.trash('/notes/a.md');
      const next = await documents.externalChange(state, '/notes/a.md');
      expect(notifier.infos).toEqual(['document.deletedOnDisk {"name":"a.md"}']);
      expect(next?.doc?.content).toBe('# A\n');
      expect(next?.doc && isDirty(next.doc)).toBe(true);
      expect(window.current?.edited).toBe(true);
    });

    it('reports other read errors and keeps the state', async () => {
      const { documents, fs, notifier, openFile } = setup();
      const state = await openFile('/notes/a.md');
      fs.failNext('readText', appError('io', 'Busy'));
      expect(await documents.externalChange(state, '/notes/a.md')).toBeNull();
      expect(notifier.errors).toEqual(['error.reload {"name":"a.md","message":"Busy"}']);
    });
  });
});
