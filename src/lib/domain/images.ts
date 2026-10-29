// Local images in Markdown: which files count as images, how a copied image is linked, and which
// `src` values of a rendered document point at a file on this computer.
import { baseName, normalisePath, resolvePath } from './paths';

/** Folder, next to the document, that dropped images are copied into. */
export const ASSETS_FOLDER = 'assets';

const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i;
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const WINDOWS_DRIVE = /^[a-z]:[\\/]/i;
const DESTINATION_ESCAPES: Readonly<Record<string, string>> = {
  '%': '%25',
  ' ': '%20',
  '(': '%28',
  ')': '%29',
  '<': '%3C',
  '>': '%3E',
};

/** True for the picture files an `<img>` can show, whatever the case of the extension. */
export const isImagePath = (path: string): boolean => IMAGE_EXTENSION.test(baseName(path));

/** The file name without its image extension (`my photo.PNG` → `my photo`). */
const imageLabel = (path: string): string => baseName(path).replace(IMAGE_EXTENSION, '');

const escapeAlt = (text: string): string => text.replace(/[\\[\]]/g, (char) => `\\${char}`);

const escapeDestination = (path: string): string =>
  path.replace(/[% ()<>]/g, (char) => DESTINATION_ESCAPES[char]);

/**
 * `![name](assets/name.png)` for the image at `relativePath` (as written in the document): the
 * alt text is the file name without extension, and characters that would end the link early are
 * escaped (spaces and parentheses as percent codes, brackets with a backslash).
 */
export const markdownImage = (relativePath: string): string =>
  `![${escapeAlt(imageLabel(relativePath))}](${escapeDestination(relativePath)})`;

const decode = (text: string): string => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

/**
 * The file on disk that an `<img src>` of the document at `documentDir` refers to, or `null` when
 * it is not a local file: other schemes (http, data, blob, javascript…), protocol-relative
 * addresses, and relative paths in a document that has no folder yet.
 */
export function localImagePath(src: string, documentDir: string | null): string | null {
  const address = src.trim();
  if (address === '' || address.startsWith('//')) return null;
  if (ANY_SCHEME.test(address) && !WINDOWS_DRIVE.test(address)) return null;
  const file = decode(address.replace(/[?#].*$/, ''));
  const isAbsolute = WINDOWS_DRIVE.test(file) || /^[\\/]/.test(file);
  if (file === '') return null;
  if (isAbsolute) return normalisePath(file);
  return documentDir === null ? null : resolvePath(documentDir, file);
}
