// The commands the app offers through shortcuts and menus, bound to the app's actions.
// Commands whose feature is not built yet are simply absent: a menu item for a missing command
// is shown disabled, and its shortcut does nothing.
import type { Command } from './commands/registry';
import { defaultAccelerators, type CommandId } from './commands/ids';
import { activeEditor } from './editor/activeEditor.svelte';
import type { App, EditMode, Layout, SidebarTab } from './app.svelte';

type Binding = Pick<Command, 'run' | 'enabled' | 'checked'> & { readonly label: string };

const WEBSITE = 'https://www.gestal.es';

const editModes: readonly EditMode[] = ['preview', 'code', 'split'];
const layouts: readonly Layout[] = ['continuous', 'pages', 'slides'];
const sidebarTabs: readonly SidebarTab[] = ['explorer', 'favourites', 'outline'];

export function createAppCommands(app: App): Command[] {
  const hasDocument = () => app.document !== null;

  const bindings: Partial<Record<CommandId, Binding>> = {
    'file.new': { label: 'menu.new', run: () => app.newDocument() },
    'file.open': { label: 'menu.open', run: () => app.openWithDialog() },
    'file.openFolder': { label: 'menu.openFolder', run: () => app.chooseFolder() },
    'file.save': { label: 'menu.save', run: () => app.save(), enabled: hasDocument },
    'file.saveAs': { label: 'menu.saveAs', run: () => app.saveAs(), enabled: hasDocument },
    'file.close': { label: 'menu.close', run: () => app.close(), enabled: hasDocument },
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
    'view.fullScreen': { label: 'menu.fullScreen', run: () => app.toggleFullscreen() },
    'view.zoomIn': { label: 'menu.zoomIn', run: () => app.zoomIn() },
    'view.zoomOut': { label: 'menu.zoomOut', run: () => app.zoomOut() },
    'view.zoomReset': { label: 'menu.zoomReset', run: () => app.resetZoom() },
    'help.website': { label: 'menu.website', run: () => void window.open(WEBSITE, '_blank') },
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

  return (Object.entries(bindings) as [CommandId, Binding][]).map(([id, binding]) => ({
    id,
    accelerator: defaultAccelerators[id],
    ...binding,
  }));
}
