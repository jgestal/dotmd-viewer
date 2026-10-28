import { LogicalPosition } from '@tauri-apps/api/dpi';
import { Menu, type MenuItemOptions, type PredefinedMenuItemOptions } from '@tauri-apps/api/menu';
import type { ContextMenu, MenuItem } from '../../ports';
import { attempt } from './invoke';

/**
 * `Menu.popup` resolves once the menu is shown or (on macOS and Windows) closed, and the Tauri API
 * has no "menu closed" event; an item's action arrives separately. So after `popup` settles we
 * wait this long for an action and treat silence as "dismissed without a choice".
 */
export const DISMISS_GRACE_MS = 200;

type NativeItem = MenuItemOptions | PredefinedMenuItemOptions;

const SEPARATOR: PredefinedMenuItemOptions = { item: 'Separator' };

const toNativeItems = (items: readonly MenuItem[], choose: (id: string) => void): NativeItem[] =>
  items.flatMap((item): NativeItem[] => [
    ...(item.separatorBefore ? [SEPARATOR] : []),
    { id: item.id, text: item.label, enabled: item.enabled ?? true, action: choose },
  ]);

/** The operating system's own pop-up menu through `@tauri-apps/api/menu`. */
export const tauriContextMenu: ContextMenu = {
  show: (items, at) =>
    attempt(async () => {
      let choose: (id: string | null) => void = () => undefined;
      const choice = new Promise<string | null>((resolve) => (choose = resolve));
      const menu = await Menu.new({ items: toNativeItems(items, choose) });
      try {
        await menu.popup(at && new LogicalPosition(at.x, at.y));
        setTimeout(() => choose(null), DISMISS_GRACE_MS);
        return await choice;
      } finally {
        await menu.close();
      }
    }),
};
