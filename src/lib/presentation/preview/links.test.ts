import { describe, expect, it } from 'vitest';
import { classifyLink } from './links';

const DIR = '/docs/notes';

describe('classifyLink', () => {
  it('treats #id as an in-page anchor and decodes it', () => {
    expect(classifyLink('#intro', DIR)).toEqual({ kind: 'anchor', id: 'intro' });
    expect(classifyLink('#a%C3%B1o', DIR)).toEqual({ kind: 'anchor', id: 'año' });
  });

  it('keeps an undecodable anchor as written', () => {
    expect(classifyLink('#100%', DIR)).toEqual({ kind: 'anchor', id: '100%' });
  });

  it('ignores an empty anchor', () => {
    expect(classifyLink('#', DIR)).toBeNull();
  });

  it('opens http, https and mailto links externally', () => {
    expect(classifyLink('https://example.com/a?b=1#c', DIR)).toEqual({
      kind: 'external',
      url: 'https://example.com/a?b=1#c',
    });
    expect(classifyLink('HTTP://example.com', DIR)?.kind).toBe('external');
    expect(classifyLink('mailto:a@b.c', DIR)).toEqual({ kind: 'external', url: 'mailto:a@b.c' });
  });

  it('ignores other schemes', () => {
    expect(classifyLink('javascript:alert(1)', DIR)).toBeNull();
    expect(classifyLink('file:///etc/a.md', DIR)).toBeNull();
    expect(classifyLink('tel:123', DIR)).toBeNull();
  });

  it('resolves relative Markdown links against the document folder', () => {
    expect(classifyLink('other.md', DIR)).toEqual({
      kind: 'document',
      path: '/docs/notes/other.md',
    });
    expect(classifyLink('../Welcome.markdown', DIR)).toEqual({
      kind: 'document',
      path: '/docs/Welcome.markdown',
    });
  });

  it('drops the query and fragment and decodes the file name', () => {
    expect(classifyLink('My%20note.md?x=1#part', DIR)).toEqual({
      kind: 'document',
      path: '/docs/notes/My note.md',
    });
  });

  it('accepts absolute Markdown paths, also with no folder', () => {
    expect(classifyLink('/a/b.md', DIR)).toEqual({ kind: 'document', path: '/a/b.md' });
    expect(classifyLink('/a/b.md', null)).toEqual({ kind: 'document', path: '/a/b.md' });
    expect(classifyLink('C:\\a\\b.md', null)).toEqual({ kind: 'document', path: 'C:/a/b.md' });
  });

  it('ignores relative links when the document has no folder', () => {
    expect(classifyLink('other.md', null)).toBeNull();
  });

  it('ignores files that are not Markdown', () => {
    expect(classifyLink('photo.png', DIR)).toBeNull();
    expect(classifyLink('notes.md.bak', DIR)).toBeNull();
  });
});
