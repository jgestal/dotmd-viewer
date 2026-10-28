// How a favourite is shown in the list: its name and, dimmed next to it, the folder it lives in.
import { baseName, dirName } from '$lib/domain/paths';

export interface FavouriteLabel {
  readonly name: string;
  readonly parent: string;
}

export function favouriteLabel(path: string): FavouriteLabel {
  const name = baseName(path);
  return name === '' ? { name: path, parent: '' } : { name, parent: dirName(path) };
}

/** Where Alt+Up / Alt+Down send the item at `index`, or `null` for other keys. */
export function reorderTarget(key: string, index: number): number | null {
  if (key === 'ArrowUp') return index - 1;
  if (key === 'ArrowDown') return index + 1;
  return null;
}
