// Keyboard shortcuts for the item a tree row stands for: menu, rename and trash.
import type { KeyEventLike, Platform } from '../commands/shortcuts';

export type RowShortcut = 'menu' | 'rename' | 'trash';

type RowKeyEvent = Pick<KeyEventLike, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>;

const onlyModifier = (event: RowKeyEvent, modifier: 'metaKey' | 'shiftKey' | null): boolean =>
  (['metaKey', 'ctrlKey', 'altKey', 'shiftKey'] as const).every(
    (name) => event[name] === (name === modifier),
  );

/** What the key press asks for on a focused row, or `null` when it is not a row shortcut. */
export function rowShortcut(event: RowKeyEvent, platform: Platform): RowShortcut | null {
  const { key } = event;
  if (key === 'ContextMenu') return 'menu';
  if (key === 'F10') return onlyModifier(event, 'shiftKey') ? 'menu' : null;
  if (key === 'Backspace' && platform === 'mac') {
    return onlyModifier(event, 'metaKey') ? 'trash' : null;
  }
  if (!onlyModifier(event, null)) return null;
  if (key === 'F2') return 'rename';
  return key === 'Delete' || key === 'Backspace' ? 'trash' : null;
}
