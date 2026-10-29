import { describe, expect, it } from 'vitest';
import { classifyDrop, isImageDrop } from './classifyDrop';

describe('classifyDrop', () => {
  it('accepts a drag whose names are not known yet as a file', () => {
    expect(classifyDrop([])).toBe('file');
  });

  it.each(['/x/a.md', '/x/a.MARKDOWN', '/x/a.mdown', '/x/a.mkd', '/x/a.txt'])(
    'treats %s as a file to open',
    (path) => expect(classifyDrop([path])).toBe('file'),
  );

  it('treats a path without extension as a folder', () => {
    expect(classifyDrop(['/x/notes'])).toBe('folder');
    expect(classifyDrop(['C:\\docs\\notes'])).toBe('folder');
  });

  it('treats a dot-folder as a folder', () => {
    expect(classifyDrop(['/x/.config'])).toBe('folder');
  });

  it('rejects other file types', () => {
    expect(classifyDrop(['/x/pic.png'])).toBe('rejected');
    expect(classifyDrop(['/x/pic.png', '/x/a.pdf'])).toBe('rejected');
  });

  it('prefers a file over a folder in a mixed drop', () => {
    expect(classifyDrop(['/x/notes', '/x/a.md'])).toBe('file');
  });

  it('accepts a mixed drop when a folder or a Markdown file is among rejected ones', () => {
    expect(classifyDrop(['/x/pic.png', '/x/notes'])).toBe('folder');
    expect(classifyDrop(['/x/pic.png', '/x/a.md'])).toBe('file');
  });
});

describe('classifyDrop with the code editor on screen', () => {
  it('offers to insert a drop made only of pictures', () => {
    expect(classifyDrop(['/x/a.png', '/x/b.JPG'], true)).toBe('images');
  });

  it('keeps rejecting pictures when no editor is on screen', () => {
    expect(classifyDrop(['/x/a.png'], false)).toBe('rejected');
    expect(classifyDrop(['/x/a.png'])).toBe('rejected');
  });

  it('opens a drop that mixes pictures with a document or a folder', () => {
    expect(classifyDrop(['/x/a.png', '/x/a.md'], true)).toBe('file');
    expect(classifyDrop(['/x/a.png', '/x/notes'], true)).toBe('folder');
  });

  it('does not take a drag whose names are not known yet for pictures', () => {
    expect(classifyDrop([], true)).toBe('file');
  });
});

describe('isImageDrop', () => {
  it('is true only when there are paths and all of them are pictures', () => {
    expect(isImageDrop(['/x/a.png'])).toBe(true);
    expect(isImageDrop([])).toBe(false);
    expect(isImageDrop(['/x/a.png', '/x/a.md'])).toBe(false);
  });
});
