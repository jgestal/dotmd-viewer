// The items of the context menu for a file or folder in the explorer or the favourites list,
// built as plain data so each combination of kind, state and platform can be tested.
import type { EntryKind, MenuItem, Translate } from '$lib/ports';
import type { Platform } from '../commands/shortcuts';

export type EntryMenuId = 'open' | 'rename' | 'trash' | 'reveal' | 'copyPath' | 'toggleFavourite';

export interface EntryMenuContext {
  readonly kind: EntryKind;
  readonly platform: Platform;
  readonly isFavourite: boolean;
  /** A favourite whose file or folder is gone: only copying the path and un-starring make sense. */
  readonly missing?: boolean;
  /** Whether the surface can rename in place (the explorer can, the favourites list cannot). */
  readonly renamable: boolean;
}

const REVEAL_LABEL: Record<Platform, string> = {
  mac: 'entryMenu.revealMac',
  windows: 'entryMenu.revealWindows',
  linux: 'entryMenu.revealLinux',
};

export function buildEntryMenu(context: EntryMenuContext, t: Translate): MenuItem[] {
  const { kind, platform, isFavourite, missing = false, renamable } = context;
  const item = (id: EntryMenuId, label: string, separatorBefore = false): MenuItem => ({
    id,
    label,
    separatorBefore,
  });
  const copyPath = item('copyPath', t('entryMenu.copyPath'));
  const favourite = item(
    'toggleFavourite',
    t(isFavourite ? 'favourites.remove' : 'favourites.add'),
    true,
  );
  if (missing) return [copyPath, favourite];
  return [
    item('open', t(kind === 'folder' ? 'entryMenu.openFolder' : 'entryMenu.open')),
    ...(renamable ? [item('rename', t('entryMenu.rename'))] : []),
    item('trash', t('entryMenu.trash')),
    item('reveal', t(REVEAL_LABEL[platform]), true),
    copyPath,
    favourite,
  ];
}
