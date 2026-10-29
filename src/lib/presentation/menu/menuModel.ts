// The native menu bar as plain data, built per platform so each desktop gets its own
// conventions (see docs/platforms.md). The infrastructure adapter turns this tree into real
// menus; nothing here knows about Tauri, so the structure is unit-tested.
import type { CommandId } from '../commands/ids';
import type { Platform } from '../commands/shortcuts';
import type { MenuNode, PredefinedMenuItem as PredefinedItem, Translate } from '$lib/ports';

export type { MenuNode };
import { baseName } from '$lib/domain/paths';

/** What the menu needs to know about each command: its accelerator and current state. */
export interface CommandState {
  readonly accelerator?: string;
  readonly enabled: boolean;
  readonly checked?: boolean;
}

export interface MenuContext {
  readonly platform: Platform;
  readonly t: Translate;
  readonly recents: readonly string[];
  /** State of a registered command, or undefined when the feature does not exist yet. */
  readonly command: (id: CommandId) => CommandState | undefined;
}

const separator: MenuNode = { kind: 'separator' };

export function buildMenu(context: MenuContext): MenuNode[] {
  const { platform, t } = context;
  const mac = platform === 'mac';

  const command = (id: CommandId, label: string): MenuNode => {
    const state = context.command(id);
    return {
      kind: 'command',
      id,
      label: t(label),
      accelerator: state?.accelerator,
      enabled: state?.enabled ?? false,
      ...(state?.checked === undefined ? {} : { checked: state.checked }),
    };
  };
  const predefined = (item: PredefinedItem, label: string): MenuNode => ({
    kind: 'predefined',
    item,
    label: t(label),
  });
  const submenu = (label: string, items: MenuNode[]): MenuNode => ({
    kind: 'submenu',
    label: t(label),
    items,
  });

  const recent = submenu('menu.openRecent', [
    ...context.recents.map((path): MenuNode => ({
      kind: 'recent',
      path,
      label: baseName(path) || path,
    })),
    ...(context.recents.length > 0 ? [separator] : []),
    command('file.clearRecents', 'menu.clearRecents'),
  ]);
  const settings = command('app.settings', 'menu.settings');
  // macOS keeps its native About panel; elsewhere that panel is poor, so the app's own dialog opens.
  const about = mac ? predefined('about', 'menu.about') : command('help.about', 'menu.about');

  const file = submenu('menu.file', [
    command('file.new', 'menu.new'),
    command('file.open', 'menu.open'),
    command('file.openFolder', 'menu.openFolder'),
    recent,
    separator,
    command('file.save', 'menu.save'),
    command('file.saveAs', 'menu.saveAs'),
    separator,
    command('file.exportPdf', 'menu.exportPdf'),
    command('file.print', 'menu.print'),
    separator,
    command('file.close', 'menu.close'),
    // Windows keeps Settings in File (like VS Code); both put Exit/Quit last in File.
    ...(platform === 'windows' ? [separator, settings] : []),
    ...(mac
      ? []
      : [separator, command('app.quit', platform === 'windows' ? 'menu.exit' : 'menu.quit')]),
  ]);

  const edit = submenu('menu.edit', [
    predefined('undo', 'menu.undo'),
    predefined('redo', 'menu.redo'),
    separator,
    predefined('cut', 'menu.cut'),
    predefined('copy', 'menu.copy'),
    predefined('paste', 'menu.paste'),
    predefined('selectAll', 'menu.selectAll'),
    separator,
    command('edit.find', 'menu.find'),
    command('edit.replace', 'menu.findReplace'),
    // GNOME and KDE put Preferences at the end of Edit.
    ...(platform === 'linux' ? [separator, settings] : []),
  ]);

  const view = submenu('menu.view', [
    command('view.toggleEdit', 'action.edit'),
    separator,
    command('view.mode.preview', 'mode.preview'),
    command('view.mode.code', 'mode.code'),
    command('view.mode.split', 'mode.split'),
    separator,
    command('view.layout.continuous', 'layout.continuous'),
    command('view.layout.pages', 'layout.pages'),
    command('view.layout.slides', 'layout.slides'),
    separator,
    command('view.toggleSidebar', 'menu.showSidebar'),
    command('view.sidebar.explorer', 'sidebar.explorer'),
    command('view.sidebar.favourites', 'sidebar.favourites'),
    command('view.sidebar.outline', 'sidebar.outline'),
    separator,
    command('view.zoomIn', 'menu.zoomIn'),
    command('view.zoomOut', 'menu.zoomOut'),
    command('view.zoomReset', 'menu.zoomReset'),
    separator,
    // macOS draws its own full-screen item (with the green button's shortcut).
    mac
      ? predefined('fullscreen', 'menu.fullScreen')
      : command('view.fullScreen', 'menu.fullScreen'),
  ]);

  const help = submenu('menu.help', [
    command('help.shortcuts', 'menu.keyboardShortcuts'),
    command('help.website', 'menu.website'),
    ...(mac ? [] : [separator, about]),
  ]);

  if (!mac) return withMnemonics([file, edit, view, help]);

  const app = submenu('app.name', [
    about,
    separator,
    settings,
    separator,
    predefined('services', 'menu.services'),
    separator,
    predefined('hide', 'menu.hide'),
    predefined('hideOthers', 'menu.hideOthers'),
    predefined('showAll', 'menu.showAll'),
    separator,
    command('app.quit', 'menu.quit'),
  ]);
  const window = submenu('menu.window', [
    predefined('minimize', 'menu.minimize'),
    predefined('maximize', 'menu.zoom'),
    separator,
    predefined('bringAllToFront', 'menu.bringAllToFront'),
  ]);
  return [app, file, edit, view, window, help];
}

/**
 * Windows and Linux underline one letter per item (Alt+letter). Each level picks, for every
 * label, the first letter not already taken at that level, and marks it with `&`.
 */
export function withMnemonics(nodes: readonly MenuNode[]): MenuNode[] {
  const taken = new Set<string>();
  return nodes.map((node) => {
    if (node.kind !== 'submenu' && node.kind !== 'command') return node;
    const label = addMnemonic(node.label, taken);
    return node.kind === 'submenu'
      ? { ...node, label, items: withMnemonics(node.items) }
      : { ...node, label };
  });
}

function addMnemonic(label: string, taken: Set<string>): string {
  const escaped = label.replaceAll('&', '&&');
  for (let index = 0; index < label.length; index++) {
    const letter = label[index].toLocaleLowerCase();
    if (!/\p{L}|\p{N}/u.test(letter) || taken.has(letter)) continue;
    taken.add(letter);
    const before = label.slice(0, index).replaceAll('&', '&&');
    return `${before}&${label.slice(index).replaceAll('&', '&&')}`;
  }
  return escaped;
}
