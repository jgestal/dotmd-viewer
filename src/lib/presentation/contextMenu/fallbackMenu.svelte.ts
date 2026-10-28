// The context menu for a plain browser (demo mode), where there is no native one: the
// ContextMenu port is answered by this store and ContextMenuFallback.svelte draws it.
import type { ContextMenu, MenuItem } from '$lib/ports';

export interface OpenMenu {
  readonly items: readonly MenuItem[];
  readonly at: { readonly x: number; readonly y: number };
  readonly resolve: (id: string | null) => void;
}

let open = $state<OpenMenu | null>(null);

/** Closes the menu and answers the pending `show` with the chosen id, or `null`. */
export const closeFallbackMenu = (id: string | null): void => {
  open?.resolve(id);
  open = null;
};

export const fallbackMenuState = {
  get open(): OpenMenu | null {
    return open;
  },
};

export const fallbackContextMenu: ContextMenu = {
  show: (items, at = { x: 0, y: 0 }) => {
    closeFallbackMenu(null);
    return new Promise((resolve) => {
      open = { items, at, resolve };
    });
  },
};
