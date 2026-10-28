// Recently opened files: most recent first, without duplicates, capped.

import { isSamePath } from './paths';

export const MAX_RECENTS = 10;

export const removeRecent = (list: readonly string[], path: string): readonly string[] =>
  list.filter((entry) => !isSamePath(entry, path));

/** Puts `path` first, dropping its earlier occurrence and anything beyond `max`. */
export const addRecent = (
  list: readonly string[],
  path: string,
  max: number = MAX_RECENTS,
): readonly string[] => [path, ...removeRecent(list, path)].slice(0, max);

export const clearRecents = (): readonly string[] => [];

/** Replaces `oldPath` by `newPath` in place; when `newPath` was already listed, only one stays. */
export const renameRecent = (
  list: readonly string[],
  oldPath: string,
  newPath: string,
): readonly string[] => {
  const renamed = list.map((entry) => (isSamePath(entry, oldPath) ? newPath : entry));
  return renamed.filter((entry, index) => renamed.findIndex((e) => isSamePath(e, entry)) === index);
};
