// What the drop overlay promises while files are still being dragged. Only the names are known
// then, not what is on disk, so a path with no extension is taken to be a folder; the real answer
// comes from the file system when the files are dropped (application/drop.ts).
import { isImagePath } from '$lib/domain/images';
import { baseName, isMarkdownPath } from '$lib/domain/paths';

export type DropKind = 'file' | 'folder' | 'images' | 'rejected';

const hasExtension = (path: string): boolean => baseName(path).lastIndexOf('.') > 0;

/** Pictures are for the code editor to link: dropped on it they are not an open request. */
export const isImageDrop = (paths: readonly string[]): boolean =>
  paths.length > 0 && paths.every(isImagePath);

/**
 * `images` if the code editor is on screen and only pictures come, else `file` if any path is a
 * Markdown file, else `folder` if any could be one, else `rejected`.
 */
export function classifyDrop(paths: readonly string[], editorVisible = false): DropKind {
  if (editorVisible && isImageDrop(paths)) return 'images';
  if (paths.length === 0 || paths.some(isMarkdownPath)) return 'file';
  return paths.some((path) => !hasExtension(path)) ? 'folder' : 'rejected';
}
