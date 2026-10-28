import { describe, expect, it } from 'vitest';
import { isPageBreakText, paginate, type PageBlock } from './paginate';

const block = (height: number, keepWithNext = false): PageBlock => ({
  height,
  keepWithNext,
  pageBreak: false,
});
const brk: PageBlock = { height: 0, keepWithNext: false, pageBreak: true };

describe('paginate', () => {
  it('gives an empty document one empty sheet', () => {
    expect(paginate([], 100)).toEqual([{ start: 0, end: 0 }]);
  });

  it('keeps blocks that fit on a single sheet', () => {
    expect(paginate([block(40), block(60)], 100)).toEqual([{ start: 0, end: 2 }]);
  });

  it('starts a new sheet for the block that does not fit', () => {
    expect(paginate([block(60), block(50), block(30)], 100)).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 3 },
    ]);
  });

  it('keeps a heading with the block after it', () => {
    expect(paginate([block(70), block(10, true), block(30)], 100)).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 3 },
    ]);
  });

  it('keeps a chain of headings with the block after them', () => {
    expect(paginate([block(70), block(10, true), block(10, true), block(30)], 100)).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 4 },
    ]);
  });

  it('puts a trailing heading on a sheet when nothing follows', () => {
    expect(paginate([block(90), block(20, true)], 100)).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 2 },
    ]);
  });

  it('gives a block taller than a sheet a sheet of its own', () => {
    expect(paginate([block(30), block(250), block(30)], 100)).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 2, end: 3 },
    ]);
  });

  it('does not tie a heading to a block that can never fit with it', () => {
    expect(paginate([block(20, true), block(250), block(30)], 100)).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 2, end: 3 },
    ]);
  });

  it('fills a sheet exactly', () => {
    expect(paginate([block(50), block(50), block(1)], 100)).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 3 },
    ]);
  });

  it('ends the sheet at a page break and leaves the break out', () => {
    expect(paginate([block(10), brk, block(10)], 100)).toEqual([
      { start: 0, end: 1 },
      { start: 2, end: 3 },
    ]);
  });

  it('ignores page breaks at the start, the end and in a row', () => {
    expect(paginate([brk, block(10), brk, brk, block(10), brk], 100)).toEqual([
      { start: 1, end: 2 },
      { start: 4, end: 5 },
    ]);
  });

  it('gives a document of only page breaks one empty sheet', () => {
    expect(paginate([brk, brk], 100)).toEqual([{ start: 0, end: 0 }]);
  });
});

describe('isPageBreakText', () => {
  it.each([
    ['\\pagebreak', true],
    ['  \\pagebreak\n', true],
    ['\\pagebreak now', false],
    ['pagebreak', false],
    ['', false],
  ])('%j is %s', (text, expected) => {
    expect(isPageBreakText(text)).toBe(expected);
  });
});
