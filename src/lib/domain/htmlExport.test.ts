import { describe, expect, it } from 'vitest';
import { dataUri, htmlFileName, imageMimeType, MAX_INLINE_IMAGE_BYTES } from './htmlExport';

describe('htmlFileName', () => {
  it.each([
    ['notes.md', 'notes.html'],
    ['Notes.MARKDOWN', 'Notes.html'],
    ['todo.txt', 'todo.html'],
    ['/docs/notes.md', '/docs/notes.html'],
    ['C:\\docs\\notes.md', 'C:\\docs\\notes.html'],
    ['Untitled', 'Untitled.html'],
    ['v1.2 plan.md', 'v1.2 plan.html'],
  ])('turns %s into %s', (name, expected) => {
    expect(htmlFileName(name)).toBe(expected);
  });
});

describe('imageMimeType', () => {
  it.each([
    ['/a/pic.png', 'image/png'],
    ['/a/pic.PNG', 'image/png'],
    ['/a/photo.jpg', 'image/jpeg'],
    ['/a/photo.jpeg', 'image/jpeg'],
    ['/a/anim.gif', 'image/gif'],
    ['/a/p.webp', 'image/webp'],
    ['/a/logo.svg', 'image/svg+xml'],
    ['/a/p.avif', 'image/avif'],
    ['/a/p.bmp', 'image/bmp'],
    ['/a/favicon.ico', 'image/x-icon'],
    ['/a/.png', 'image/png'],
  ])('maps %s to %s', (path, expected) => {
    expect(imageMimeType(path)).toBe(expected);
  });

  it.each(['/a/notes.md', '/a/script.js', '/a/png', '/a.d/noextension', '/a/file.constructor'])(
    'is null for %s, which is not an image file',
    (path) => {
      expect(imageMimeType(path)).toBeNull();
    },
  );
});

describe('dataUri', () => {
  it('joins the media type and the base64 payload', () => {
    expect(dataUri('image/png', 'QUJD')).toBe('data:image/png;base64,QUJD');
  });
});

describe('MAX_INLINE_IMAGE_BYTES', () => {
  it('is 10 MB', () => {
    expect(MAX_INLINE_IMAGE_BYTES).toBe(10 * 1024 * 1024);
  });
});
