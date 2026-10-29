// Export to a standalone HTML page: the default file name and what it takes to embed an image.
import { baseName, withoutMarkdownExtension } from './paths';

/** Larger local images are not embedded: the page would grow too much, so they keep their link. */
export const MAX_INLINE_IMAGE_BYTES = 10 * 1024 * 1024;

const IMAGE_MIME_TYPES: ReadonlyMap<string, string> = new Map([
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['gif', 'image/gif'],
  ['webp', 'image/webp'],
  ['svg', 'image/svg+xml'],
  ['avif', 'image/avif'],
  ['bmp', 'image/bmp'],
  ['ico', 'image/x-icon'],
]);

/** `notes.md` → `notes.html`; a full path keeps its folder. */
export const htmlFileName = (documentName: string): string =>
  `${withoutMarkdownExtension(documentName)}.html`;

/** The media type of the image file at `path`, from its extension; `null` when it is no image. */
export function imageMimeType(path: string): string | null {
  const name = baseName(path);
  const dot = name.lastIndexOf('.');
  return dot < 0 ? null : (IMAGE_MIME_TYPES.get(name.slice(dot + 1).toLowerCase()) ?? null);
}

export const dataUri = (mimeType: string, base64: string): string =>
  `data:${mimeType};base64,${base64}`;
