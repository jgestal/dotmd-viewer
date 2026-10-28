import { describe, expect, it } from 'vitest';
import { slideAtLine, splitSlides, type Slide } from './slides';

const slide = (markdown: string, startLine: number, endLine: number): Slide => ({
  markdown,
  startLine,
  endLine,
});

describe('splitSlides', () => {
  it('returns no slides for an empty or whitespace-only document', () => {
    expect(splitSlides('')).toEqual([]);
    expect(splitSlides('  \n\n \t\n')).toEqual([]);
  });

  it('returns the whole body as one slide when there are no separators', () => {
    expect(splitSlides('# Title\n\ntext')).toEqual([slide('# Title\n\ntext', 0, 2)]);
  });

  it('splits at a top-level separator and reports line numbers', () => {
    expect(splitSlides('# A\n\n---\n\n# B\nmore')).toEqual([
      slide('# A', 0, 0),
      slide('# B\nmore', 4, 5),
    ]);
  });

  it('accepts up to three leading spaces and trailing spaces', () => {
    expect(splitSlides('a\n\n   ---  \n\nb').map((s) => s.markdown)).toEqual(['a', 'b']);
  });

  it('does not split at four leading spaces, extra dashes or other thematic breaks', () => {
    for (const hr of ['    ---', '----', '--', '***', '___', '--- x']) {
      expect(splitSlides(`a\n\n${hr}\n\nb`)).toHaveLength(1);
    }
  });

  it('does not treat a Setext underline as a separator', () => {
    expect(splitSlides('Heading\n---\n\ntext')).toEqual([slide('Heading\n---\n\ntext', 0, 3)]);
  });

  it('ignores separators inside backtick and tilde fences', () => {
    const backticks = '```\n\n---\n\n```';
    const tildes = '~~~md\n\n---\n\n~~~';
    expect(splitSlides(`${backticks}\n\n---\n\n${tildes}`).map((s) => s.markdown)).toEqual([
      backticks,
      tildes,
    ]);
  });

  it('treats the rest of the document as code after an unclosed fence', () => {
    expect(splitSlides('```\n\n---\n\nx')).toHaveLength(1);
  });

  it('drops empty slides from consecutive, leading and trailing separators', () => {
    expect(splitSlides('\n---\n\na\n\n---\n\n---\n\nb\n\n---\n')).toEqual([
      slide('a', 3, 3),
      slide('b', 9, 9),
    ]);
  });

  it('trims leading and trailing blank lines of a slide', () => {
    expect(splitSlides('\n\na\n\n\n---\n\n\n\nb\n\n')).toEqual([
      slide('a', 2, 2),
      slide('b', 9, 9),
    ]);
  });

  it('handles CRLF line endings', () => {
    expect(splitSlides('a\r\n\r\n---\r\n\r\nb\r\nc')).toEqual([
      slide('a', 0, 0),
      slide('b\nc', 4, 5),
    ]);
  });

  it('skips front matter, including its fences and any --- inside it, and offsets lines', () => {
    const doc = '---\ntitle: x\nsep: ---\n---\n\n# A\n\n---\n\n# B';
    expect(splitSlides(doc)).toEqual([slide('# A', 5, 5), slide('# B', 9, 9)]);
  });

  it('returns no slides for a document that is only front matter', () => {
    expect(splitSlides('---\ntitle: x\n---\n')).toEqual([]);
  });
});

describe('slideAtLine', () => {
  const slides = splitSlides('\n# A\nline\n\n---\n\n# B\n\n---\n\n# C');
  // A: lines 1-2, separator: 4, B: 6, separator: 8, C: 10

  it('returns -1 when there are no slides', () => {
    expect(slideAtLine([], 3)).toBe(-1);
  });

  it('returns the slide that contains the line', () => {
    expect(slideAtLine(slides, 1)).toBe(0);
    expect(slideAtLine(slides, 2)).toBe(0);
    expect(slideAtLine(slides, 6)).toBe(1);
    expect(slideAtLine(slides, 10)).toBe(2);
  });

  it('returns the nearest previous slide for a line on a separator or blank line', () => {
    expect(slideAtLine(slides, 4)).toBe(0);
    expect(slideAtLine(slides, 5)).toBe(0);
    expect(slideAtLine(slides, 8)).toBe(1);
  });

  it('clamps lines before the first and after the last slide', () => {
    expect(slideAtLine(slides, 0)).toBe(0);
    expect(slideAtLine(slides, -5)).toBe(0);
    expect(slideAtLine(slides, 999)).toBe(2);
  });
});
