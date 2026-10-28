import { describe, expect, it } from 'vitest';
import { codeLineMask, splitFrontMatter, splitLines } from './markdownLines';

describe('splitLines', () => {
  it('splits on LF, CRLF and CR', () => {
    expect(splitLines('a\nb\r\nc\rd')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps a trailing empty line', () => {
    expect(splitLines('a\n')).toEqual(['a', '']);
  });
});

describe('splitFrontMatter', () => {
  it('returns the whole text as body when there is no front matter', () => {
    expect(splitFrontMatter('# Title\ntext')).toEqual({
      frontMatter: null,
      body: '# Title\ntext',
      bodyStartLine: 0,
    });
  });

  it('separates a front matter closed with ---', () => {
    expect(splitFrontMatter('---\ntitle: A\ntags: [x]\n---\n# Body')).toEqual({
      frontMatter: 'title: A\ntags: [x]',
      body: '# Body',
      bodyStartLine: 4,
    });
  });

  it('accepts ... as closing fence and CRLF line endings', () => {
    expect(splitFrontMatter('---\r\ntitle: A\r\n...\r\nbody')).toEqual({
      frontMatter: 'title: A',
      body: 'body',
      bodyStartLine: 3,
    });
  });

  it('accepts an empty front matter', () => {
    expect(splitFrontMatter('---\n---\nbody')).toEqual({
      frontMatter: '',
      body: 'body',
      bodyStartLine: 2,
    });
  });

  it('ignores a byte order mark before the opening fence', () => {
    expect(splitFrontMatter('\uFEFF---\na: 1\n---\nbody').frontMatter).toBe('a: 1');
  });

  it('treats an unclosed opening fence as body', () => {
    const text = '---\nnot closed';
    expect(splitFrontMatter(text)).toEqual({ frontMatter: null, body: text, bodyStartLine: 0 });
  });

  it('only recognises a fence on the first line', () => {
    expect(splitFrontMatter('\n---\na: 1\n---').frontMatter).toBeNull();
  });
});

describe('codeLineMask', () => {
  it('marks backtick fences and their content', () => {
    expect(codeLineMask(['a', '```js', '# x', '```', 'b'])).toEqual([
      false,
      true,
      true,
      true,
      false,
    ]);
  });

  it('marks tilde fences', () => {
    expect(codeLineMask(['~~~', 'x', '~~~', 'y'])).toEqual([true, true, true, false]);
  });

  it('closes only with the same character and at least the same length', () => {
    expect(codeLineMask(['````', '```', '~~~~', '````', 'out'])).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it('does not close on a fence followed by an info string', () => {
    expect(codeLineMask(['```', '```js', '```', 'out'])).toEqual([true, true, true, false]);
  });

  it('allows up to three spaces of indentation', () => {
    expect(codeLineMask(['   ```', 'x', '   ```', 'y'])).toEqual([true, true, true, false]);
    expect(codeLineMask(['    ```', 'x'])).toEqual([false, false]);
  });

  it('runs an unclosed fence to the end', () => {
    expect(codeLineMask(['a', '```', 'b', 'c'])).toEqual([false, true, true, true]);
  });

  it('needs three fence characters', () => {
    expect(codeLineMask(['``', 'x'])).toEqual([false, false]);
  });
});
