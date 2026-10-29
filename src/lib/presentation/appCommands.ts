// The commands the app offers through shortcuts and menus, bound to the app's actions.
// Commands whose feature is not built yet are simply absent: a menu item for a missing command
// is shown disabled, and its shortcut does nothing.
import type { Command } from './commands/registry';
import { defaultAccelerators, type CommandId } from './commands/ids';
import { themeLabel } from './settingsOptions';
import { AUTHOR_WEBSITE } from './credits';
import { dialogs } from './dialogs.svelte';
import { activeEditor } from './editor/activeEditor.svelte';
import { THEMES } from '$lib/domain/theme';
import type { App, EditMode, Layout, SidebarTab } from './app.svelte';

type Binding = Pick<Command, 'run' | 'enabled' | 'checked'> & { readonly label: string };

// Exported so the i18n tests can enumerate the keys built from these lists (`mode.${mode}`, ...).
export const editModes: readonly EditMode[] = ['preview', 'code', 'split'];
export const layouts: readonly Layout[] = ['continuous', 'pages', 'slides'];
export const sidebarTabs: readonly SidebarTab[] = ['explorer', 'favourites', 'outline'];

export function createAppCommands(app: App): Command[] {
  const hasDocument = () => app.document !== null;

  const bindings: Partial<Record<CommandId, Binding>> = {
    'file.new': { label: 'menu.new', run: () => app.newDocument() },
    'file.open': { label: 'menu.open', run: () => app.openWithDialog() },
    'file.openFolder': { label: 'menu.openFolder', run: () => app.chooseFolder() },
    'file.save': { label: 'menu.save', run: () => app.save(), enabled: hasDocument },
    'file.saveAs': { label: 'menu.saveAs', run: () => app.saveAs(), enabled: hasDocument },
    'file.close': { label: 'menu.close', run: () => app.close(), enabled: hasDocument },
    'file.exportPdf': { label: 'menu.exportPdf', run: () => app.exportPdf(), enabled: hasDocument },
    'file.exportHtml': {
      label: 'menu.exportHtml',
      run: () => app.exportHtml(),
      enabled: hasDocument,
    },
    'file.print': { label: 'menu.print', run: () => app.print(), enabled: hasDocument },
    'edit.find': {
      label: 'menu.find',
      run: () => activeEditor.current?.find(),
      enabled: () => activeEditor.current !== null,
    },
    'edit.replace': {
      label: 'menu.findReplace',
      run: () => activeEditor.current?.replace(),
      enabled: () => activeEditor.current !== null,
    },
    'view.toggleEdit': {
      label: 'action.edit',
      run: () => app.toggleEditing(),
      enabled: hasDocument,
      checked: () => app.editing,
    },
    'view.toggleSidebar': {
      label: 'menu.showSidebar',
      run: () => app.toggleSidebar(),
      checked: () => app.preferences.sidebarVisible,
    },
    'file.clearRecents': {
      label: 'menu.clearRecents',
      run: () => app.clearRecents(),
      enabled: () => app.preferences.recents.length > 0,
    },
    'view.theme.next': { label: 'menu.nextTheme', run: () => app.cycleTheme() },
    'view.fullScreen': { label: 'menu.fullScreen', run: () => app.toggleFullscreen() },
    'view.zoomIn': { label: 'menu.zoomIn', run: () => app.zoomIn() },
    'view.zoomOut': { label: 'menu.zoomOut', run: () => app.zoomOut() },
    'view.zoomReset': { label: 'menu.zoomReset', run: () => app.resetZoom() },
    'app.settings': { label: 'menu.settings', run: () => dialogs.open('settings') },
    'help.guide': { label: 'menu.guide', run: () => void app.openGuide() },
    'help.shortcuts': { label: 'menu.keyboardShortcuts', run: () => dialogs.open('shortcuts') },
    'help.about': { label: 'menu.about', run: () => dialogs.open('about') },
    'app.quit': { label: 'menu.quit', run: () => app.quit() },
    'help.website': { label: 'menu.website', run: () => void app.openExternal(AUTHOR_WEBSITE) },
  };

  for (const mode of editModes) {
    bindings[`view.mode.${mode}`] = {
      label: `mode.${mode}`,
      run: () => app.setEditMode(mode),
      enabled: hasDocument,
      checked: () => app.editing && app.preferences.editMode === mode,
    };
  }
  for (const layout of layouts) {
    bindings[`view.layout.${layout}`] = {
      label: `layout.${layout}`,
      run: () => app.setLayout(layout),
      checked: () => app.preferences.layout === layout,
    };
  }
  for (const tab of sidebarTabs) {
    bindings[`view.sidebar.${tab}`] = {
      label: `sidebar.${tab}`,
      run: () => app.showSidebarTab(tab),
      checked: () => app.preferences.sidebarVisible && app.preferences.sidebarTab === tab,
    };
  }

  for (const theme of THEMES) {
    bindings[`view.theme.${theme}`] = {
      label: themeLabel(theme),
      run: () => app.setTheme(theme),
      checked: () => app.preferences.theme === theme,
    };
  }

  return (Object.entries(bindings) as [CommandId, Binding][]).map(([id, binding]) => ({
    id,
    accelerator: defaultAccelerators[id],
    ...binding,
  }));
}
