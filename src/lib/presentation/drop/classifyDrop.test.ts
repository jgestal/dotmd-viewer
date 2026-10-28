import { describe, expect, it } from 'vitest';
import { classifyDrop } from './classifyDrop';

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
