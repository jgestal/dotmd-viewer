import type { EntryKind } from '$lib/ports';

/** How many characters of `name` the rename field selects first: a file's name without its extension. */
export function renameSelectionEnd(name: string, kind: EntryKind): number {
  const dot = name.lastIndexOf('.');
  return kind === 'file' && dot > 0 ? dot : name.length;
}
