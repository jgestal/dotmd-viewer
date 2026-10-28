// What the drop overlay promises while files are still being dragged. Only the names are known
// then, not what is on disk, so a path with no extension is taken to be a folder; the real answer
// comes from the file system when the files are dropped (application/drop.ts).
import { baseName, isMarkdownPath } from '$lib/domain/paths';

export type DropKind = 'file' | 'folder' | 'rejected';

const hasExtension = (path: string): boolean => baseName(path).lastIndexOf('.') > 0;

/** `file` if any path is a Markdown file, else `folder` if any could be one, else `rejected`. */
export function classifyDrop(paths: readonly string[]): DropKind {
  if (paths.length === 0 || paths.some(isMarkdownPath)) return 'file';
  return paths.some((path) => !hasExtension(path)) ? 'folder' : 'rejected';
}
