// The items of the context menus inside the document area (reading views, visual editor, code
// editor, header title), built as plain data so each state and platform can be tested.
import type { MenuItem, Translate } from '$lib/ports';
import type { Platform } from '../commands/shortcuts';

export type DocumentMenuId =
  | 'cut'
  | 'copy'
  | 'paste'
  | 'selectAll'
  | 'find'
  | 'openLink'
  | 'copyLink'
  | 'copyImage'
  | 'toggleEdit'
  | 'exportPdf'
  | 'exportHtml'
  | 'print'
  | 'reveal'
  | 'copyPath'
  | 'showInSidebar';

export interface DocumentMenuContext {
  readonly platform: Platform;
  /** Whether the document is saved on disk: revealing and copying its path need a file. */
  readonly hasPath: boolean;
  readonly hasSelection: boolean;
}

export interface PreviewMenuContext extends DocumentMenuContext {
  /** The preview is the editable one: the clipboard commands lead the menu, as in any editor. */
  readonly editing: boolean;
  /** There is a link under the pointer. */
  readonly link?: boolean;
  /** There is an image under the pointer. */
  readonly image?: boolean;
}

export interface TitleMenuContext {
  readonly platform: Platform;
  readonly hasPath: boolean;
  /** The file sits inside the folder the explorer shows. */
  readonly inOpenFolder: boolean;
}

const REVEAL_LABEL: Record<Platform, string> = {
  mac: 'entryMenu.revealMac',
  windows: 'entryMenu.revealWindows',
  linux: 'entryMenu.revealLinux',
};

const entry = (
  id: DocumentMenuId,
  label: string,
  { enabled = true, separatorBefore = false } = {},
): MenuItem => ({ id, label, enabled, separatorBefore });

/** Cut, Copy, Paste and Select All, or only Copy and Select All where nothing can be changed. */
function clipboardItems(editable: boolean, hasSelection: boolean, t: Translate): MenuItem[] {
  return [
    ...(editable ? [entry('cut', t('menu.cut'), { enabled: hasSelection })] : []),
    entry('copy', t('menu.copy'), { enabled: hasSelection }),
    ...(editable ? [entry('paste', t('menu.paste'))] : []),
    entry('selectAll', t('menu.selectAll')),
  ];
}

function targetItems(link: boolean, image: boolean, t: Translate): MenuItem[] {
  const items = [
    ...(link
      ? [
          entry('openLink', t('documentMenu.openLink')),
          entry('copyLink', t('documentMenu.copyLink')),
        ]
      : []),
    ...(image ? [entry('copyImage', t('documentMenu.copyImage'))] : []),
  ];
  return items.map((item, index) => (index === 0 ? { ...item, separatorBefore: true } : item));
}

/** The menu of the rendered document (continuous, pages, slides) and of the visual editor. */
export function buildPreviewMenu(context: PreviewMenuContext, t: Translate): MenuItem[] {
  const { platform, hasPath, hasSelection, editing, link = false, image = false } = context;
  return [
    ...clipboardItems(editing, hasSelection, t),
    ...targetItems(link, image, t),
    entry('toggleEdit', t(editing ? 'action.stopEditing' : 'action.edit'), {
      separatorBefore: true,
    }),
    entry('exportPdf', t('menu.exportPdf')),
    entry('exportHtml', t('menu.exportHtml')),
    entry('print', t('menu.print')),
    entry('reveal', t(REVEAL_LABEL[platform]), { enabled: hasPath, separatorBefore: true }),
    entry('copyPath', t('entryMenu.copyPath'), { enabled: hasPath }),
  ];
}

/** The menu of the code editor: clipboard, then Find, then export and print. */
export function buildCodeMenu(context: DocumentMenuContext, t: Translate): MenuItem[] {
  return [
    ...clipboardItems(true, context.hasSelection, t),
    entry('find', t('menu.find'), { separatorBefore: true }),
    entry('exportPdf', t('menu.exportPdf'), { separatorBefore: true }),
    entry('exportHtml', t('menu.exportHtml')),
    entry('print', t('menu.print')),
  ];
}

/** The menu of the document's title in the header. */
export function buildTitleMenu(context: TitleMenuContext, t: Translate): MenuItem[] {
  const { platform, hasPath, inOpenFolder } = context;
  return [
    entry('reveal', t(REVEAL_LABEL[platform]), { enabled: hasPath }),
    entry('copyPath', t('entryMenu.copyPath'), { enabled: hasPath }),
    entry('showInSidebar', t('documentMenu.showInSidebar'), {
      enabled: hasPath && inOpenFolder,
      separatorBefore: true,
    }),
  ];
}
