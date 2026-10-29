// What the context menu of a file or folder does. The explorer and the favourites list share it;
// anything that changes the disk is followed by a refresh of the folders it touched.
import { toAppError } from '$lib/domain/errors';
import type { EntryKind } from '$lib/ports';
import { app } from '../app.svelte';
import { explorer } from '../explorer/explorer.svelte';
import { i18n } from '../i18n/i18n.svelte';
import { notifier } from '../toasts.svelte';
import { buildEntryMenu, type EntryMenuId } from './entryMenu';

export interface MenuTarget {
  readonly path: string;
  readonly kind: EntryKind;
  /** A favourite whose item is gone. */
  readonly missing?: boolean;
}

export interface MenuPlacement {
  readonly x: number;
  readonly y: number;
}

/** Renames in place and refreshes the folders involved; answers the new path, or `null`. */
export async function renameEntry(
  path: string,
  newName: string,
  kind: EntryKind,
): Promise<string | null> {
  const change = await app.renameEntry(path, newName, kind);
  if (change) await explorer.refreshAround(change.from, change.to);
  return change?.to ?? null;
}

/** Moves into `folder` and refreshes the folders involved; failures such as a name clash are toasts. */
export async function moveEntry(path: string, folder: string): Promise<void> {
  const change = await app.moveEntry(path, folder);
  if (change) await explorer.refreshAround(change.from, change.to, folder);
}

/** Trashes after asking, refreshes the folder it was in, and answers whether it happened. */
export async function trashEntry(path: string): Promise<boolean> {
  const trashed = await app.trashEntry(path);
  if (trashed) await explorer.refreshAround(path);
  return trashed;
}

async function copyPath(path: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(path);
    notifier.info(i18n.t('entryMenu.pathCopied'));
  } catch {
    notifier.error(i18n.t('entryMenu.copyFailed'));
  }
}

function run(id: EntryMenuId, { path, kind }: MenuTarget, rename: (() => void) | undefined): void {
  const actions: Record<EntryMenuId, () => unknown> = {
    open: () => (kind === 'folder' ? app.openFolder(path) : app.open(path)),
    rename: () => rename?.(),
    trash: () => trashEntry(path),
    reveal: () => app.revealEntry(path),
    copyPath: () => copyPath(path),
    toggleFavourite: () => app.toggleFavourite(path, kind),
  };
  void actions[id]();
}

/**
 * Pops up the context menu of `target` and runs the chosen action. `rename` starts renaming in
 * the surface that called; without it the menu has no Rename item.
 */
export async function showEntryMenu(
  target: MenuTarget,
  at: MenuPlacement,
  rename?: () => void,
): Promise<void> {
  const items = buildEntryMenu(
    {
      kind: target.kind,
      platform: app.platform,
      isFavourite: app.isFavourite(target.path),
      missing: target.missing,
      renamable: rename !== undefined,
    },
    (key, vars) => i18n.t(key, vars),
  );
  try {
    const id = await app.container.contextMenu.show(items, at);
    if (id !== null) run(id as EntryMenuId, target, rename);
  } catch (thrown) {
    notifier.error(toAppError(thrown).message);
  }
}
