// Recently opened files: most recent first, without duplicates, capped.

export const MAX_RECENTS = 10;

/** Paths are the same file when they differ only in separator style or a trailing slash. */
const identity = (path: string): string => path.replaceAll('\\', '/').replace(/\/+$/, '');

const samePath = (a: string, b: string): boolean => identity(a) === identity(b);

export const removeRecent = (list: readonly string[], path: string): readonly string[] =>
  list.filter((entry) => !samePath(entry, path));

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
  const renamed = list.map((entry) => (samePath(entry, oldPath) ? newPath : entry));
  return renamed.filter((entry, index) => renamed.findIndex((e) => samePath(e, entry)) === index);
};
