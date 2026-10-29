// What the context menus of the document area do. Export, print, edit and find go through the
// app's commands; the clipboard acts on the surface the menu was opened on.
import { toAppError } from '$lib/domain/errors';
import { localImagePath } from '$lib/domain/images';
import { dirName, isSameOrInside } from '$lib/domain/paths';
import type { MenuItem } from '$lib/ports';
import type { CommandId } from '../commands/ids';
import { app } from '../app.svelte';
import { activeEditor, type EditorActions } from '../editor/activeEditor.svelte';
import { explorer } from '../explorer/explorer.svelte';
import { i18n } from '../i18n/i18n.svelte';
import { notifier } from '../toasts.svelte';
import {
  buildCodeMenu,
  buildPreviewMenu,
  buildTitleMenu,
  type DocumentMenuId,
} from './documentMenu';

const COMMANDS: Partial<Record<DocumentMenuId, CommandId>> = {
  toggleEdit: 'view.toggleEdit',
  exportPdf: 'file.exportPdf',
  print: 'file.print',
  find: 'edit.find',
};

const translate = (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars);

async function copyText(text: string, confirmation?: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    if (confirmation) notifier.info(confirmation);
  } catch {
    notifier.error(i18n.t('documentMenu.clipboardFailed'));
  }
}

/** Pops up `items` where the pointer is and answers the chosen id; failures are toasts. */
async function choose(items: MenuItem[], event: MouseEvent): Promise<DocumentMenuId | null> {
  event.preventDefault();
  try {
    const id = await app.container.contextMenu.show(items, { x: event.clientX, y: event.clientY });
    return id as DocumentMenuId | null;
  } catch (thrown) {
    notifier.error(toAppError(thrown).message);
    return null;
  }
}

/** Runs what the preview, code and title menus share; answers whether `id` was one of those. */
function runShared(id: DocumentMenuId, path: string | null): boolean {
  const command = COMMANDS[id];
  if (command) app.runCommand(command);
  else if (id === 'reveal' && path) void app.revealEntry(path);
  else if (id === 'copyPath' && path) void copyText(path, i18n.t('entryMenu.pathCopied'));
  else return false;
  return true;
}

const selectedText = (): string => window.getSelection()?.toString() ?? '';

// The rendered document and the visual editor

interface PreviewTarget {
  readonly link: Element | null;
  readonly image: Element | null;
  readonly scope: Element;
  readonly editable: HTMLElement | null;
  readonly selection: string;
}

function previewTarget(event: MouseEvent): PreviewTarget {
  const target = event.target as Element;
  const editing = app.editing;
  return {
    link: editing ? null : target.closest('a[href]'),
    image: editing ? null : target.closest('img'),
    scope: target.closest('.markdown-body') ?? (event.currentTarget as Element),
    editable: target.closest<HTMLElement>('[contenteditable="true"]'),
    selection: selectedText(),
  };
}

/** The file an image refers to, or its address when it is not a local file. */
function imageAddress(image: Element): string {
  const source = image.getAttribute('data-source') ?? image.getAttribute('src') ?? '';
  const dir = app.document?.path ? dirName(app.document.path) : null;
  return localImagePath(source, dir) ?? source;
}

async function pasteInto(editable: HTMLElement): Promise<void> {
  try {
    const text = await navigator.clipboard.readText();
    editable.focus();
    document.execCommand('insertText', false, text);
  } catch {
    notifier.error(i18n.t('documentMenu.clipboardFailed'));
  }
}

async function cutFrom(editable: HTMLElement, text: string): Promise<void> {
  await copyText(text);
  editable.focus();
  document.execCommand('delete');
}

function selectAllIn(target: PreviewTarget): void {
  if (target.editable) {
    target.editable.focus();
    document.execCommand('selectAll');
  } else {
    window.getSelection()?.selectAllChildren(target.scope);
  }
}

function runPreview(id: DocumentMenuId, target: PreviewTarget): void {
  const { link, image, editable, selection } = target;
  const actions: Partial<Record<DocumentMenuId, () => unknown>> = {
    copy: () => copyText(selection),
    cut: () => editable && cutFrom(editable, selection),
    paste: () => editable && pasteInto(editable),
    selectAll: () => selectAllIn(target),
    // The click is the one the document already handles for internal and external links.
    openLink: () => (link as HTMLElement | null)?.click(),
    copyLink: () => copyText(link?.getAttribute('href') ?? ''),
    copyImage: () => image && copyText(imageAddress(image)),
  };
  if (!runShared(id, app.document?.path ?? null)) void actions[id]?.();
}

/** The context menu of the reading views and of the editable preview. */
export async function showPreviewMenu(event: MouseEvent): Promise<void> {
  const target = previewTarget(event);
  const items = buildPreviewMenu(
    {
      platform: app.platform,
      hasPath: app.document?.path != null,
      hasSelection: target.selection !== '',
      editing: app.editing,
      link: target.link !== null,
      image: target.image !== null,
    },
    translate,
  );
  const id = await choose(items, event);
  if (id !== null) runPreview(id, target);
}

// The code editor

async function runEditor(id: DocumentMenuId, editor: EditorActions): Promise<void> {
  const selection = editor.selectedText();
  if (id === 'copy') await copyText(selection);
  else if (id === 'selectAll') editor.selectAll();
  else if (id === 'cut') {
    await copyText(selection);
    editor.replaceSelection('');
  } else if (id === 'paste') {
    try {
      editor.replaceSelection(await navigator.clipboard.readText());
    } catch {
      notifier.error(i18n.t('documentMenu.clipboardFailed'));
    }
  } else runShared(id, null);
}

/** The context menu of the code editor. */
export async function showCodeMenu(event: MouseEvent): Promise<void> {
  const editor = activeEditor.current;
  if (!editor) return;
  const items = buildCodeMenu(
    {
      platform: app.platform,
      hasPath: app.document?.path != null,
      hasSelection: editor.selectedText() !== '',
    },
    translate,
  );
  const id = await choose(items, event);
  if (id !== null) await runEditor(id, editor);
}

// The title in the header

function inOpenFolder(path: string | null): boolean {
  const folder = app.preferences.lastFolder;
  return path !== null && folder !== null && isSameOrInside(folder, path);
}

function showInSidebar(path: string): void {
  app.showSidebarTab('explorer');
  explorer.reveal(path);
}

/** The context menu of the document's name in the header. */
export async function showTitleMenu(event: MouseEvent): Promise<void> {
  const path = app.document?.path ?? null;
  const items = buildTitleMenu(
    { platform: app.platform, hasPath: path !== null, inOpenFolder: inOpenFolder(path) },
    translate,
  );
  const id = await choose(items, event);
  if (id === 'showInSidebar' && path) showInSidebar(path);
  else if (id !== null) runShared(id, path);
}
