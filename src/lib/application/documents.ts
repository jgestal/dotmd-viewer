// Use cases for the single open document: open, save, save as, close, and external changes.
// They work on a plain state object the presentation owns. Each use case takes the current
// state and returns the next one, or `null` when nothing changed (cancelled, failed or ignored).

import {
  displayName,
  editDocument,
  isDirty,
  markSaved,
  markUnsaved,
  newDocument,
  openDocument,
  reloadFromDisk,
  serialise,
  type Document,
} from '../domain/document';
import { toAppError } from '../domain/errors';
import { baseName, isSamePath } from '../domain/paths';
import type {
  AppWindow,
  Dialogs,
  FileFilter,
  FileSystem,
  FileWatcher,
  Notifier,
  Translate,
} from '../ports';

export interface DocumentState {
  readonly doc: Document | null;
}

/** A successful open; the presentation passes `openedPath` to the recents use case. */
export interface OpenResult {
  readonly state: DocumentState;
  readonly openedPath: string;
}

export interface DocumentsDeps {
  readonly fs: FileSystem;
  readonly dialogs: Dialogs;
  readonly window: AppWindow;
  readonly watcher: FileWatcher;
  readonly notifier: Notifier;
  readonly t: Translate;
}

export interface Documents {
  open(state: DocumentState, path: string): Promise<OpenResult | null>;
  openWithDialog(state: DocumentState): Promise<OpenResult | null>;
  newDocument(state: DocumentState): Promise<DocumentState | null>;
  save(state: DocumentState): Promise<DocumentState | null>;
  saveAs(state: DocumentState): Promise<DocumentState | null>;
  close(state: DocumentState): Promise<DocumentState | null>;
  /** True when the window may close: nothing unsaved, or the user saved or discarded it. */
  confirmQuit(state: DocumentState): Promise<boolean>;
  edit(state: DocumentState, content: string): Promise<DocumentState>;
  externalChange(state: DocumentState, path: string): Promise<DocumentState | null>;
}

const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'txt'] as const;
const DEFAULT_EXTENSION = '.md';

const withExtension = (path: string): string =>
  baseName(path).lastIndexOf('.') > 0 ? path : `${path}${DEFAULT_EXTENSION}`;

export const createDocuments = ({
  fs,
  dialogs,
  window,
  watcher,
  notifier,
  t,
}: DocumentsDeps): Documents => {
  /** What we last wrote, so the watcher's echo of our own save is not taken for an external edit. */
  let lastWrite: { readonly path: string; readonly content: string } | null = null;

  const filters = (): readonly FileFilter[] => [
    { name: t('filter.markdown'), extensions: MARKDOWN_EXTENSIONS },
  ];

  const nameOf = (doc: Document): string => displayName(doc, t('document.untitled'));

  const show = (doc: Document): Promise<void> =>
    window.showDocument(nameOf(doc), doc.path, isDirty(doc));

  /** Writes `doc` to `path`, then follows it with the watcher and the window; `null` after telling the user why not. */
  const persist = async (doc: Document, path: string): Promise<DocumentState | null> => {
    try {
      await fs.writeText(path, {
        content: serialise(doc),
        encoding: doc.encoding,
        hasBom: doc.hasBom,
      });
      lastWrite = { path, content: doc.content };
      const saved = markSaved(doc, path);
      await watcher.watch(path);
      await show(saved);
      return { doc: saved };
    } catch (thrown) {
      notifier.error(
        t('error.save', { name: baseName(path), message: toAppError(thrown).message }),
      );
      return null;
    }
  };

  const saveAs = async (state: DocumentState): Promise<DocumentState | null> => {
    if (state.doc === null) return null;
    const defaultPath = state.doc.path ?? `${t('document.untitled')}${DEFAULT_EXTENSION}`;
    const chosen = await dialogs.saveFile(defaultPath, filters());
    return chosen === null ? null : persist(state.doc, withExtension(chosen));
  };

  const save = async (state: DocumentState): Promise<DocumentState | null> => {
    if (state.doc === null) return null;
    return state.doc.path === null ? saveAs(state) : persist(state.doc, state.doc.path);
  };

  /** True when the current document may be replaced: it is clean, or the user saved or discarded it. */
  const resolveUnsaved = async (state: DocumentState): Promise<boolean> => {
    if (state.doc === null || !isDirty(state.doc)) return true;
    const choice = await dialogs.askUnsaved(nameOf(state.doc));
    if (choice === 'cancel') return false;
    return choice === 'discard' || (await save(state)) !== null;
  };

  const open = async (state: DocumentState, path: string): Promise<OpenResult | null> => {
    if (state.doc?.path != null && isSamePath(state.doc.path, path)) return null;
    if (!(await resolveUnsaved(state))) return null;
    try {
      const file = await fs.readText(path);
      const doc = openDocument({ path, raw: file.content, ...file });
      await watcher.watch(path);
      await show(doc);
      return { state: { doc }, openedPath: path };
    } catch (thrown) {
      notifier.error(
        t('error.open', { name: baseName(path), message: toAppError(thrown).message }),
      );
      return null;
    }
  };

  const openWithDialog = async (state: DocumentState): Promise<OpenResult | null> => {
    const chosen = await dialogs.openFile(filters());
    return chosen === null ? null : open(state, chosen);
  };

  const startNew = async (state: DocumentState): Promise<DocumentState | null> => {
    if (!(await resolveUnsaved(state))) return null;
    const doc = newDocument();
    await watcher.watch(null);
    await show(doc);
    return { doc };
  };

  const close = async (state: DocumentState): Promise<DocumentState | null> => {
    if (!(await resolveUnsaved(state))) return null;
    await watcher.watch(null);
    await window.showDocument(t('app.name'), null, false);
    return { doc: null };
  };

  const edit = async (state: DocumentState, content: string): Promise<DocumentState> => {
    if (state.doc === null) return state;
    const doc = editDocument(state.doc, content);
    if (isDirty(doc) !== isDirty(state.doc)) await show(doc);
    return { doc };
  };

  const keepMineOrTakeDisk = (doc: Document): Promise<boolean> =>
    dialogs.confirm(
      t('reload.conflict.title'),
      t('reload.conflict.message', { name: nameOf(doc) }),
      t('reload.keepMine'),
      t('reload.useDisk'),
    );

  const isOwnEcho = (path: string, content: string): boolean =>
    lastWrite !== null && isSamePath(lastWrite.path, path) && lastWrite.content === content;

  const externalChange = async (
    state: DocumentState,
    path: string,
  ): Promise<DocumentState | null> => {
    const { doc } = state;
    if (doc?.path == null || !isSamePath(doc.path, path)) return null;
    try {
      const file = await fs.readText(doc.path);
      if (isOwnEcho(path, file.content)) return null;
      const reloaded = reloadFromDisk(doc, file.content);
      if (!reloaded.conflict) return isDirty(doc) ? null : { doc: reloaded.doc };
      if (await keepMineOrTakeDisk(doc)) return null;
      const fromDisk = openDocument({ path: doc.path, raw: file.content, ...file });
      await show(fromDisk);
      return { doc: fromDisk };
    } catch (thrown) {
      const error = toAppError(thrown);
      if (error.kind !== 'notFound') {
        notifier.error(t('error.reload', { name: nameOf(doc), message: error.message }));
        return null;
      }
      notifier.info(t('document.deletedOnDisk', { name: nameOf(doc) }));
      const unsaved = markUnsaved(doc);
      await show(unsaved);
      return { doc: unsaved };
    }
  };

  return {
    open,
    openWithDialog,
    newDocument: startNew,
    save,
    saveAs,
    close,
    confirmQuit: resolveUnsaved,
    edit,
    externalChange,
  };
};
