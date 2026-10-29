import { describe, expect, it } from 'vitest';
import {
  applyBlockEdit,
  blockRanges,
  commonEnds,
  lineAt,
  lineEndingOf,
  restoreSyntax,
  splitPrefix,
  withLineEnding,
  type IndexedBody,
} from './sourceBlocks';

describe('splitPrefix', () => {
  it('keeps the front matter verbatim as a prefix', () => {
    const text = '---\ntitle: A\n---\n\n# Body\n';
    expect(splitPrefix(text)).toEqual({
      prefix: '---\ntitle: A\n---\n',
      body: '\n# Body\n',
      bodyStartLine: 3,
    });
  });

  it('keeps CRLF line breaks and a byte order mark inside the prefix', () => {
    const text = '\uFEFF---\r\ntitle: A\r\n---\r\nBody';
    expect(splitPrefix(text)).toEqual({
      prefix: '\uFEFF---\r\ntitle: A\r\n---\r\n',
      body: 'Body',
      bodyStartLine: 3,
    });
  });

  it('gives a front matter with nothing after it an empty body', () => {
    expect(splitPrefix('---\ntitle: A\n---')).toEqual({
      prefix: '---\ntitle: A\n---',
      body: '',
      bodyStartLine: 3,
    });
  });

  it('leaves a document without front matter whole', () => {
    expect(splitPrefix('# Title\n')).toEqual({ prefix: '', body: '# Title\n', bodyStartLine: 0 });
  });

  it('does not take a slide separator for front matter', () => {
    expect(splitPrefix('---\n# Slide\n---\n').prefix).toBe('');
  });
});

describe('line endings', () => {
  it('detects the first line ending', () => {
    expect(lineEndingOf('a\r\nb\n')).toBe('\r\n');
    expect(lineEndingOf('a\nb')).toBe('\n');
    expect(lineEndingOf('a\rb')).toBe('\r');
    expect(lineEndingOf('single line')).toBe('\n');
  });

  it('rewrites the editor output to the document line ending', () => {
    expect(withLineEnding('a\nb\n', '\r\n')).toBe('a\r\nb\r\n');
    expect(withLineEnding('a\nb', '\n')).toBe('a\nb');
  });

  it('numbers lines from one whatever the ending', () => {
    expect(lineAt('a\r\nb\nc', 0)).toBe(1);
    expect(lineAt('a\r\nb\nc', 3)).toBe(2);
    expect(lineAt('a\r\nb\nc', 5)).toBe(3);
  });
});

describe('blockRanges', () => {
  it('keeps the positions the parser gave', () => {
    const spans = [
      { from: 0, to: 3 },
      { from: 5, to: 8 },
    ];
    expect(blockRanges('# A\n\nb c\n', spans)).toEqual(spans);
  });

  it('fills a block without position with the trimmed text between its neighbours', () => {
    const body = 'a\n\n$$\nx\n$$\n\nb\n';
    expect(blockRanges(body, [{ from: 0, to: 1 }, null, { from: 12, to: 13 }])).toEqual([
      { from: 0, to: 1 },
      { from: 3, to: 10 },
      { from: 12, to: 13 },
    ]);
  });

  it('fills blocks without position at both ends of the body', () => {
    expect(blockRanges('\n x \n', [null])).toEqual([{ from: 2, to: 3 }]);
    expect(blockRanges('a\n\n', [{ from: 0, to: 1 }, null])).toEqual([
      { from: 0, to: 1 },
      { from: 3, to: 3 },
    ]);
  });
});

describe('commonEnds', () => {
  const same = (a: string, b: string) => a === b;

  it('counts the shared start and end', () => {
    expect(commonEnds(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'd'], same)).toEqual({
      head: 1,
      tail: 2,
    });
  });

  it('never lets head and tail overlap', () => {
    expect(commonEnds(['a', 'a'], ['a', 'a', 'a'], same)).toEqual({ head: 2, tail: 0 });
    expect(commonEnds(['a'], ['a', 'b', 'a'], same)).toEqual({ head: 1, tail: 0 });
  });

  it('handles empty lists', () => {
    expect(commonEnds([], ['a'], same)).toEqual({ head: 0, tail: 0 });
  });
});

describe('applyBlockEdit', () => {
  // Three blocks written in a style the editor would not produce.
  const body = '* one\n* two\n\nA  *para*\n\n|a|b|\n|-|-|\n';
  const indexed: IndexedBody = {
    body,
    ranges: [
      { from: 0, to: 11 },
      { from: 13, to: 22 },
      { from: 24, to: 35 },
    ],
  };
  const block = (text: string) => ({ middle: text, middleRanges: [{ from: 0, to: text.length }] });

  it('replaces only the changed block and keeps the others byte for byte', () => {
    const result = applyBlockEdit(indexed, { head: 1, tail: 1, ...block('A _para_ more') });
    expect(result.body).toBe('* one\n* two\n\nA _para_ more\n\n|a|b|\n|-|-|\n');
    expect(result.ranges).toEqual([
      { from: 0, to: 11 },
      { from: 13, to: 26 },
      { from: 28, to: 39 },
    ]);
  });

  it('returns the same body when nothing changed', () => {
    expect(applyBlockEdit(indexed, { head: 3, tail: 0, middle: '', middleRanges: [] })).toBe(
      indexed,
    );
  });

  it('deletes a block together with one separator', () => {
    const middle = applyBlockEdit(indexed, { head: 1, tail: 1, middle: '', middleRanges: [] });
    expect(middle.body).toBe('* one\n* two\n\n|a|b|\n|-|-|\n');
    expect(middle.ranges).toEqual([
      { from: 0, to: 11 },
      { from: 13, to: 24 },
    ]);
    const last = applyBlockEdit(indexed, { head: 2, tail: 0, middle: '', middleRanges: [] });
    expect(last.body).toBe('* one\n* two\n\nA  *para*\n');
  });

  it('inserts new blocks after a kept one, before the first, or into an empty body', () => {
    expect(applyBlockEdit(indexed, { head: 3, tail: 0, ...block('new') }).body).toBe(
      `${body.trimEnd()}\n\nnew\n`,
    );
    const first = applyBlockEdit(indexed, { head: 0, tail: 3, ...block('new') });
    expect(first.body).toBe(`new\n\n${body}`);
    expect(first.ranges[0]).toEqual({ from: 0, to: 3 });
    expect(first.ranges[1]).toEqual({ from: 5, to: 16 });
    const empty = applyBlockEdit({ body: '\n', ranges: [] }, { head: 0, tail: 0, ...block('x') });
    expect(empty).toEqual({ body: 'x\n', ranges: [{ from: 0, to: 1 }] });
  });

  it('separates inserted blocks with the document line ending', () => {
    const crlf = { body: 'a\r\n', ranges: [{ from: 0, to: 1 }] };
    expect(applyBlockEdit(crlf, { head: 1, tail: 0, ...block('b') }).body).toBe('a\r\n\r\nb\r\n');
  });
});

describe('restoreSyntax', () => {
  it('unescapes GitHub alert markers, nested ones too', () => {
    expect(restoreSyntax('> \\[!NOTE]\n> text')).toBe('> [!NOTE]\n> text');
    expect(restoreSyntax('> > \\[!warning]')).toBe('> > [!warning]');
  });

  it('leaves other escaped brackets alone', () => {
    expect(restoreSyntax('\\[!NOTE] outside a quote')).toBe('\\[!NOTE] outside a quote');
    expect(restoreSyntax('> \\[link]')).toBe('> \\[link]');
  });
});
