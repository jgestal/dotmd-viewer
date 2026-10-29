import { normalisePath } from '../../domain/paths';
import type { AssetUrls } from '../../ports';

/** Images the demo and the tests provide as `data:` URLs; any other path cannot be shown. */
export class MemoryAssetUrls implements AssetUrls {
  private readonly urls = new Map<string, string>();

  seed(path: string, url: string): void {
    this.urls.set(normalisePath(path), url);
  }

  toUrl(path: string): string | null {
    return this.urls.get(normalisePath(path)) ?? null;
  }
}
