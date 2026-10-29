import { describe, expect, it } from 'vitest';
import { appError } from '$lib/domain/errors';
import { MAX_INLINE_IMAGE_BYTES } from '$lib/domain/htmlExport';
import { MemoryFileSystem } from '$lib/infrastructure/memory';
import { inlineLocalImages } from './inlineImages';

const PNG_BYTES = new Uint8Array([137, 80, 78, 71]);
const PNG_BASE64 = 'iVBORw==';

const rootWith = (html: string): HTMLElement => {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
};

const sources = (fs: MemoryFileSystem, documentDir: string | null = '/d') => ({ documentDir, fs });

describe('inlineLocalImages', () => {
  it('embeds a relative image as a data URI of its contents', async () => {
    const fs = new MemoryFileSystem();
    fs.seedBinary('/d/assets/pic.png', PNG_BYTES);
    const root = rootWith('<img src="assets/pic.png" alt="x">');
    await inlineLocalImages(root, sources(fs));
    expect(root.querySelector('img')?.getAttribute('src')).toBe(
      `data:image/png;base64,${PNG_BASE64}`,
    );
  });

  it('embeds an absolute path and decodes percent escapes in the reference', async () => {
    const fs = new MemoryFileSystem();
    fs.seedBinary('/other/my pic.JPG', PNG_BYTES);
    const root = rootWith('<img src="/other/my%20pic.JPG">');
    await inlineLocalImages(root, sources(fs));
    expect(root.querySelector('img')?.getAttribute('src')).toBe(
      `data:image/jpeg;base64,${PNG_BASE64}`,
    );
  });

  it('leaves remote and data images alone without touching the disk', async () => {
    const fs = new MemoryFileSystem();
    const html =
      '<img src="https://example.com/a.png"><img src="//cdn.example.com/b.png"><img src="data:image/png;base64,AAAA">';
    const root = rootWith(html);
    await inlineLocalImages(root, sources(fs));
    expect(root.innerHTML).toBe(html);
    expect(fs.calls).toEqual([]);
  });

  it('keeps the reference of an image larger than the size cap', async () => {
    const fs = new MemoryFileSystem();
    fs.seedBinary('/d/big.png', new Uint8Array(MAX_INLINE_IMAGE_BYTES + 1));
    fs.seedBinary('/d/exact.png', new Uint8Array(MAX_INLINE_IMAGE_BYTES));
    const root = rootWith('<img src="big.png"><img src="exact.png">');
    await inlineLocalImages(root, sources(fs));
    const [big, exact] = [...root.querySelectorAll('img')];
    expect(big.getAttribute('src')).toBe('big.png');
    expect(exact.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
  });

  it('asks the file system for at most the size cap', async () => {
    const fs = new MemoryFileSystem();
    fs.seedBinary('/d/a.png', PNG_BYTES);
    await inlineLocalImages(rootWith('<img src="a.png">'), sources(fs));
    expect(fs.calls).toEqual([{ method: 'readBase64', args: ['/d/a.png'] }]);
  });

  it('keeps the reference of a missing or unreadable image', async () => {
    const fs = new MemoryFileSystem();
    fs.seedBinary('/d/locked.png', PNG_BYTES);
    fs.failNext('readBase64', appError('permissionDenied', 'Denied', '/d/locked.png'));
    const root = rootWith('<img src="locked.png"><img src="missing.png">');
    await inlineLocalImages(root, sources(fs));
    expect(root.innerHTML).toBe('<img src="locked.png"><img src="missing.png">');
  });

  it('does not read files that are not images', async () => {
    const fs = new MemoryFileSystem();
    fs.seedFile('/d/notes.md', 'x');
    const root = rootWith('<img src="notes.md">');
    await inlineLocalImages(root, sources(fs));
    expect(root.querySelector('img')?.getAttribute('src')).toBe('notes.md');
    expect(fs.calls).toEqual([]);
  });

  it('leaves relative images alone in a document that is not saved yet', async () => {
    const fs = new MemoryFileSystem();
    const root = rootWith('<img src="pic.png">');
    await inlineLocalImages(root, sources(fs, null));
    expect(root.querySelector('img')?.getAttribute('src')).toBe('pic.png');
    expect(fs.calls).toEqual([]);
  });

  it('embeds every image of the document', async () => {
    const fs = new MemoryFileSystem();
    fs.seedBinary('/d/a.png', PNG_BYTES);
    fs.seedBinary('/d/b.svg', new Uint8Array([60, 115]));
    const root = rootWith('<p><img src="a.png"></p><img src="b.svg"><img src="a.png">');
    await inlineLocalImages(root, sources(fs));
    expect([...root.querySelectorAll('img')].map((image) => image.getAttribute('src'))).toEqual([
      `data:image/png;base64,${PNG_BASE64}`,
      'data:image/svg+xml;base64,PHM=',
      `data:image/png;base64,${PNG_BASE64}`,
    ]);
  });
});
