import { localImagePath } from '$lib/domain/images';
import type { AssetUrls } from '$lib/ports';

/** Where the document lives and how its local files reach the webview. */
export interface ImageSources {
  readonly documentDir: string | null;
  readonly assetUrls: AssetUrls;
}

function resolveOne(source: string, { documentDir, assetUrls }: ImageSources): string | null {
  const path = localImagePath(source, documentDir);
  return path === null ? null : assetUrls.toUrl(path);
}

/** A `srcset` with each local candidate resolved; descriptors such as `2x` are kept. */
function resolveSrcset(srcset: string, sources: ImageSources): string {
  return srcset
    .split(',')
    .map((candidate) => {
      const [url = '', ...descriptors] = candidate.trim().split(/\s+/);
      const resolved = resolveOne(url, sources) ?? url;
      return [resolved, ...descriptors].join(' ');
    })
    .join(', ');
}

/**
 * Points every `<img>` that refers to a file on this computer (a path relative to the document or
 * an absolute one) at a URL the webview can load, and does the same for the `srcset` of `<img>` and
 * `<picture>` sources. Remote images are left alone, and so is an image
 * the environment cannot load, which then shows as a broken image with its alt text. Run after
 * sanitising: the sanitiser only ever sees the original `src`, so no new scheme gets through it.
 */
export function resolveLocalImages(root: ParentNode, sources: ImageSources): void {
  for (const image of root.querySelectorAll('img[src]')) {
    const source = image.getAttribute('src') ?? '';
    const url = resolveOne(source, sources);
    if (url === null) continue;
    // The original reference stays available, e.g. to copy the file's path from the context menu.
    image.setAttribute('data-source', source);
    image.setAttribute('src', url);
  }
  for (const element of root.querySelectorAll('img[srcset], source[srcset]')) {
    element.setAttribute('srcset', resolveSrcset(element.getAttribute('srcset') ?? '', sources));
  }
}
