import { describe, expect, it } from 'vitest';
import {
  detectLineEnding,
  displayName,
  editDocument,
  isDirty,
  markSaved,
  newDocument,
  openDocument,
  reloadFromDisk,
  serialise,
  type Document,
} from './document';

const open = (raw: string, path: string | null = '/notes/a.md'): Document =>
  openDocument({ path, raw, encoding: 'utf-8', hasBom: false });

describe('detectLineEnding', () => {
  it('is lf for text without line breaks', () => {
    expect(detectLineEnding('')).toBe('lf');
    expect(detectLineEnding('one line')).toBe('lf');
  });

  it('is lf for LF-only text', () => {
    expect(detectLineEnding('a\nb\nc')).toBe('lf');
  });

  it('is crlf for CRLF-only text', () => {
    expect(detectLineEnding('a\r\nb\r\nc')).toBe('crlf');
  });

  it('picks the most frequent ending in mixed text', () => {
    expect(detectLineEnding('a\r\nb\r\nc\nd')).toBe('crlf');
    expect(detectLineEnding('a\nb\nc\r\nd')).toBe('lf');
  });

  it('is lf on a tie', () => {
    expect(detectLineEnding('a\r\nb\nc')).toBe('lf');
  });

  it('ignores lone CR when counting', () => {
    expect(detectLineEnding('a\rb\rc\r\nd')).toBe('crlf');
    expect(detectLineEnding('a\rb\rc')).toBe('lf');
  });
});

describe('openDocument', () => {
  it('normalises CRLF to LF and remembers the ending', () => {
    const doc = open('a\r\nb\r\n');
    expect(doc.content).toBe('a\nb\n');
    expect(doc.savedContent).toBe('a\nb\n');
    expect(doc.lineEnding).toBe('crlf');
  });

  it('turns a lone CR into a line break', () => {
    expect(open('a\rb').content).toBe('a\nb');
  });

  it('keeps path, encoding and BOM as given', () => {
    const doc = openDocument({ path: 'C:\\n.md', raw: 'x', encoding: 'utf-16le', hasBom: true });
    expect(doc).toEqual({
      path: 'C:\\n.md',
      content: 'x',
      savedContent: 'x',
      lineEnding: 'lf',
      encoding: 'utf-16le',
      hasBom: true,
    });
  });

  it('opens an empty file as a clean empty document', () => {
    const doc = open('');
    expect(doc.content).toBe('');
    expect(doc.lineEnding).toBe('lf');
    expect(isDirty(doc)).toBe(false);
  });

  it('preserves Unicode content', () => {
    expect(open('héllo 🌍\r\n日本語').content).toBe('héllo 🌍\n日本語');
  });
});

describe('newDocument', () => {
  it('is empty, unsaved, LF, UTF-8 without BOM', () => {
    expect(newDocument()).toEqual({
      path: null,
      content: '',
      savedContent: '',
      lineEnding: 'lf',
      encoding: 'utf-8',
      hasBom: false,
    });
  });
});

describe('editDocument', () => {
  it('replaces the content and leaves the saved text alone', () => {
    const doc = editDocument(open('a'), 'b');
    expect(doc.content).toBe('b');
    expect(doc.savedContent).toBe('a');
  });

  it('normalises pasted CRLF and CR to LF', () => {
    expect(editDocument(open('a'), 'x\r\ny\rz').content).toBe('x\ny\nz');
  });

  it('does not mutate the original', () => {
    const original = open('a');
    editDocument(original, 'b');
    expect(original.content).toBe('a');
  });
});

describe('isDirty', () => {
  it('is false right after opening', () => {
    expect(isDirty(open('a'))).toBe(false);
  });

  it('is true after an edit', () => {
    expect(isDirty(editDocument(open('a'), 'b'))).toBe(true);
  });

  it('is false after editing and reverting', () => {
    expect(isDirty(editDocument(editDocument(open('a'), 'b'), 'a'))).toBe(false);
  });

  it('is false when a CRLF paste equals the saved text', () => {
    expect(isDirty(editDocument(open('a\nb'), 'a\r\nb'))).toBe(false);
  });
});

describe('serialise', () => {
  it('round-trips a CRLF file byte for byte', () => {
    const raw = 'a\r\n\r\nb\r\n';
    expect(serialise(open(raw))).toBe(raw);
  });

  it('round-trips an LF file', () => {
    const raw = 'a\n\nb\n';
    expect(serialise(open(raw))).toBe(raw);
  });

  it('round-trips an empty file', () => {
    expect(serialise(open(''))).toBe('');
  });

  it('writes edits with the original CRLF ending', () => {
    expect(serialise(editDocument(open('a\r\nb'), 'x\ny\nz'))).toBe('x\r\ny\r\nz');
  });

  it('converts a lone CR to the document line ending', () => {
    expect(serialise(open('a\rb'))).toBe('a\nb');
    expect(serialise(open('a\rb\r\nc\r\nd'))).toBe('a\r\nb\r\nc\r\nd');
  });

  it('normalises mixed endings to the dominant one', () => {
    expect(serialise(open('a\r\nb\r\nc\nd'))).toBe('a\r\nb\r\nc\r\nd');
  });
});

describe('markSaved', () => {
  it('makes the document clean and keeps the path on Save', () => {
    const saved = markSaved(editDocument(open('a'), 'b'));
    expect(saved.savedContent).toBe('b');
    expect(saved.path).toBe('/notes/a.md');
    expect(isDirty(saved)).toBe(false);
  });

  it('changes the path on Save As', () => {
    const saved = markSaved(editDocument(open('a'), 'b'), '/other/b.md');
    expect(saved.path).toBe('/other/b.md');
    expect(saved.content).toBe('b');
  });

  it('gives a new document its first path', () => {
    const saved = markSaved(editDocument(newDocument(), 'x'), 'C:\\docs\\new.md');
    expect(saved.path).toBe('C:\\docs\\new.md');
    expect(isDirty(saved)).toBe(false);
  });

  it('keeps line ending, encoding and BOM', () => {
    const doc = openDocument({ path: '/a.md', raw: 'a\r\n', encoding: 'utf-16be', hasBom: true });
    const saved = markSaved(doc, '/b.md');
    expect(saved.lineEnding).toBe('crlf');
    expect(saved.encoding).toBe('utf-16be');
    expect(saved.hasBom).toBe(true);
  });
});

describe('reloadFromDisk', () => {
  it('replaces the content of a clean document without conflict', () => {
    const { doc, conflict } = reloadFromDisk(open('a'), 'b\r\nc');
    expect(conflict).toBe(false);
    expect(doc.content).toBe('b\nc');
    expect(doc.savedContent).toBe('b\nc');
    expect(doc.lineEnding).toBe('crlf');
    expect(doc.path).toBe('/notes/a.md');
  });

  it('keeps the edits of a dirty document and reports the conflict', () => {
    const dirty = editDocument(open('a'), 'mine');
    const { doc, conflict } = reloadFromDisk(dirty, 'theirs');
    expect(conflict).toBe(true);
    expect(doc).toBe(dirty);
  });

  it('reports no conflict when the file did not really change', () => {
    const dirty = editDocument(open('a\nb'), 'mine');
    const { doc, conflict } = reloadFromDisk(dirty, 'a\r\nb');
    expect(conflict).toBe(false);
    expect(doc).toBe(dirty);
  });
});

describe('displayName', () => {
  it('returns the untitled label when there is no path', () => {
    expect(displayName(newDocument(), 'Untitled')).toBe('Untitled');
  });

  it('returns the file name of a POSIX path', () => {
    expect(displayName(open('', '/home/me/notes/readme.md'), 'Untitled')).toBe('readme.md');
  });

  it('returns the file name of a Windows path', () => {
    expect(displayName(open('', 'C:\\Users\\me\\notes\\readme.md'), 'Untitled')).toBe('readme.md');
  });

  it('handles mixed separators', () => {
    expect(displayName(open('', 'C:\\Users/me\\a b.md'), 'Untitled')).toBe('a b.md');
  });

  it('returns a bare file name as is', () => {
    expect(displayName(open('', 'a.md'), 'Untitled')).toBe('a.md');
  });
});
