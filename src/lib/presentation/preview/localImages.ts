import { localImagePath } from '$lib/domain/images';
import type { AssetUrls } from '$lib/ports';

/** Where the document lives and how its local files reach the webview. */
export interface ImageSources {
  readonly documentDir: string | null;
  readonly assetUrls: AssetUrls;
}

/**
 * Points every `<img>` that refers to a file on this computer (a path relative to the document or
 * an absolute one) at a URL the webview can load. Remote images are left alone, and so is an image
 * the environment cannot load, which then shows as a broken image with its alt text. Run after
 * sanitising: the sanitiser only ever sees the original `src`, so no new scheme gets through it.
 */
export function resolveLocalImages(
  root: ParentNode,
  { documentDir, assetUrls }: ImageSources,
): void {
  for (const image of root.querySelectorAll('img[src]')) {
    const path = localImagePath(image.getAttribute('src') ?? '', documentDir);
    const url = path === null ? null : assetUrls.toUrl(path);
    if (url !== null) image.setAttribute('src', url);
  }
}
