import { describe, expect, it } from 'vitest';
import { ASSETS_FOLDER, isImagePath, localImagePath, markdownImage } from './images';

describe('isImagePath', () => {
  it.each(['a.png', 'a.JPG', 'a.jpeg', 'a.gif', 'a.webp', 'a.svg', 'a.avif', 'a.bmp', 'a.ico'])(
    'accepts %s',
    (name) => expect(isImagePath(`/x/${name}`)).toBe(true),
  );

  it.each(['a.md', 'a.pdf', 'png', 'a.png.txt', 'a.pngx', 'folder.png/readme'])(
    'rejects %s',
    (name) => expect(isImagePath(`/x/${name}`)).toBe(false),
  );

  it('works with Windows paths', () => {
    expect(isImagePath('C:\\pics\\holiday.PNG')).toBe(true);
  });
});

describe('markdownImage', () => {
  it('links the image with its name without extension as alt text', () => {
    expect(markdownImage(`${ASSETS_FOLDER}/cat.png`)).toBe('![cat](assets/cat.png)');
  });

  it('escapes spaces and parentheses in the destination as percent codes', () => {
    expect(markdownImage('assets/my photo (1).png')).toBe(
      '![my photo (1)](assets/my%20photo%20%281%29.png)',
    );
  });

  it('escapes percent signs and angle brackets in the destination', () => {
    expect(markdownImage('assets/100%<a>.png')).toBe('![100%<a>](assets/100%25%3Ca%3E.png)');
  });

  it('escapes brackets and backslashes in the alt text', () => {
    expect(markdownImage('assets/[x]y.png')).toBe('![\\[x\\]y](assets/[x]y.png)');
  });

  it('keeps Unicode as it is', () => {
    expect(markdownImage('assets/ñandú.jpg')).toBe('![ñandú](assets/ñandú.jpg)');
  });
});

describe('localImagePath', () => {
  it('resolves a relative source against the document folder', () => {
    expect(localImagePath('assets/a.png', '/docs/notes')).toBe('/docs/notes/assets/a.png');
    expect(localImagePath('./a.png', '/docs')).toBe('/docs/a.png');
  });

  it('follows .. out of the folder', () => {
    expect(localImagePath('../img/b.jpg', '/docs/notes')).toBe('/docs/img/b.jpg');
  });

  it('decodes percent codes and drops query and fragment', () => {
    expect(localImagePath('my%20pic.png?v=2#top', '/d')).toBe('/d/my pic.png');
  });

  it('keeps a source that is not valid percent encoding as it is', () => {
    expect(localImagePath('100%.png', '/d')).toBe('/d/100%.png');
  });

  it('keeps absolute POSIX and Windows paths', () => {
    expect(localImagePath('/pics/a.png', '/docs')).toBe('/pics/a.png');
    expect(localImagePath('C:\\pics\\a.png', '/docs')).toBe('C:/pics/a.png');
    expect(localImagePath('/pics/a.png', null)).toBe('/pics/a.png');
  });

  it('looks for a scheme only at the start of the address', () => {
    expect(localImagePath('img/x:y.png', '/docs')).toBe('/docs/img/x:y.png');
  });

  it('trims the address', () => {
    expect(localImagePath('  a.png ', '/d')).toBe('/d/a.png');
  });

  it.each([
    'http://x.org/a.png',
    'https://x.org/a.png',
    'data:image/png;base64,AAAA',
    'blob:abc',
    'javascript:alert(1)',
    'file:///etc/passwd',
    '//cdn.x.org/a.png',
    '',
    '   ',
    '#top',
    '?v=1',
  ])('is not a local file: %s', (src) => expect(localImagePath(src, '/d')).toBeNull());

  it('cannot resolve a relative source without a document folder', () => {
    expect(localImagePath('a.png', null)).toBeNull();
  });
});
