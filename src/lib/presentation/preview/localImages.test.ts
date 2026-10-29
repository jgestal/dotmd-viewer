import { describe, expect, it } from 'vitest';
import { MemoryAssetUrls } from '$lib/infrastructure/memory';
import { resolveLocalImages } from './localImages';

const page = (html: string): HTMLElement => {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container;
};

const sources = () => {
  const assetUrls = new MemoryAssetUrls();
  assetUrls.seed('/docs/assets/a.png', 'asset://a');
  assetUrls.seed('/img/b.jpg', 'asset://b');
  assetUrls.seed('/abs/c.png', 'asset://c');
  return { documentDir: '/docs/notes', assetUrls };
};

const srcs = (root: HTMLElement): (string | null)[] =>
  [...root.querySelectorAll('img')].map((image) => image.getAttribute('src'));

describe('resolveLocalImages', () => {
  it('turns relative and absolute local sources into asset URLs', () => {
    const root = page(
      '<img src="../assets/a.png"><img src="../../img/b.jpg"><img src="/abs/c.png">',
    );
    resolveLocalImages(root, sources());
    expect(srcs(root)).toEqual(['asset://a', 'asset://b', 'asset://c']);
  });

  it('keeps the original reference of a resolved image, and only of that one', () => {
    const root = page('<img src="../assets/a.png"><img src="https://x.org/a.png">');
    resolveLocalImages(root, sources());
    expect(
      [...root.querySelectorAll('img')].map((image) => image.getAttribute('data-source')),
    ).toEqual(['../assets/a.png', null]);
  });

  it('leaves remote and data images untouched', () => {
    const html =
      '<img src="https://x.org/a.png"><img src="http://x.org/b.png"><img src="data:image/png;base64,AA">';
    const root = page(html);
    resolveLocalImages(root, sources());
    expect(srcs(root)).toEqual([
      'https://x.org/a.png',
      'http://x.org/b.png',
      'data:image/png;base64,AA',
    ]);
  });

  it('leaves a local image the environment cannot load as it is', () => {
    const root = page('<img src="missing.png">');
    resolveLocalImages(root, sources());
    expect(srcs(root)).toEqual(['missing.png']);
  });

  it('does not resolve relative sources of a document without a folder', () => {
    const root = page('<img src="assets/a.png"><img src="/abs/c.png">');
    resolveLocalImages(root, { ...sources(), documentDir: null });
    expect(srcs(root)).toEqual(['assets/a.png', 'asset://c']);
  });

  it('ignores images without a source', () => {
    const root = page('<img alt="none">');
    resolveLocalImages(root, sources());
    expect(srcs(root)).toEqual([null]);
  });

  it('resolves the srcset of picture sources and images, keeping descriptors', () => {
    const root = page(
      '<picture><source media="(prefers-color-scheme: dark)" srcset="../assets/a.png">' +
        '<img src="/abs/c.png" srcset="/abs/c.png 1x, ../../img/b.jpg 2x, https://x.org/r.png 3x"></picture>',
    );
    resolveLocalImages(root, sources());
    expect(root.querySelector('source')?.getAttribute('srcset')).toBe('asset://a');
    expect(root.querySelector('img')?.getAttribute('srcset')).toBe(
      'asset://c 1x, asset://b 2x, https://x.org/r.png 3x',
    );
  });

  it('leaves a srcset candidate the environment cannot load as it is', () => {
    const root = page('<img srcset="missing.png 2x">');
    resolveLocalImages(root, sources());
    expect(root.querySelector('img')?.getAttribute('srcset')).toBe('missing.png 2x');
  });
});
