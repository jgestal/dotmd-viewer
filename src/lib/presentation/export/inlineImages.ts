import { dataUri, imageMimeType, MAX_INLINE_IMAGE_BYTES } from '$lib/domain/htmlExport';
import { localImagePath } from '$lib/domain/images';
import type { FileSystem } from '$lib/ports';

export interface InlineImageSources {
  readonly documentDir: string | null;
  readonly fs: Pick<FileSystem, 'readBase64'>;
}

/** The data: URI of the local image `src` refers to, or `null` to keep the original reference. */
async function embeddedSource(src: string, sources: InlineImageSources): Promise<string | null> {
  const path = localImagePath(src, sources.documentDir);
  const mimeType = path === null ? null : imageMimeType(path);
  if (path === null || mimeType === null) return null;
  try {
    const base64 = await sources.fs.readBase64(path, MAX_INLINE_IMAGE_BYTES);
    return base64 === null ? null : dataUri(mimeType, base64);
  } catch {
    return null;
  }
}

/**
 * Replaces the `src` of every `<img>` that points at an image file on this computer by a data:
 * URI of its contents, so the exported page needs no files beside it. Remote and data images are
 * left alone, and so is a local image that is missing, unreadable or larger than the size cap.
 */
export async function inlineLocalImages(root: ParentNode, sources: InlineImageSources) {
  await Promise.all(
    [...root.querySelectorAll('img[src]')].map(async (image) => {
      const embedded = await embeddedSource(image.getAttribute('src') ?? '', sources);
      if (embedded !== null) image.setAttribute('src', embedded);
    }),
  );
}
