import { describe, expect, it } from 'vitest';
import {
  buildAnchors,
  ECHO_WINDOW_MS,
  isEcho,
  lineForOffset,
  offsetForLine,
  type RenderedBlock,
} from './scrollSync';

// A fake document of 100 lines: a heading on line 1, a paragraph on 3, a tall table on 10 and a
// paragraph on 50. The preview is 1000 px long, so its maximum scroll offset is 800.
const blocks: readonly RenderedBlock[] = [
  { start: 1, top: 32 },
  { start: 3, top: 100 },
  { start: 10, top: 200 },
  { start: 50, top: 600 },
];
const end = { line: 90, offset: 800 };
const anchors = buildAnchors(blocks, end);

describe('buildAnchors', () => {
  it('starts at the top, keeps the blocks in order and ends at the bottom', () => {
    expect(anchors).toEqual([
      { line: 0, offset: 0 },
      { line: 2, offset: 100 },
      { line: 9, offset: 200 },
      { line: 49, offset: 600 },
      { line: 90, offset: 800 },
    ]);
  });

  it('skips blocks nested on the same line as the previous one', () => {
    const nested = [
      { start: 5, top: 100 },
      { start: 5, top: 110 },
      { start: 6, top: 130 },
    ];
    expect(buildAnchors(nested, { line: 20, offset: 400 })).toEqual([
      { line: 0, offset: 0 },
      { line: 4, offset: 100 },
      { line: 5, offset: 130 },
      { line: 20, offset: 400 },
    ]);
  });

  it('skips blocks at or beyond the last line the editor can show at the top', () => {
    expect(buildAnchors([{ start: 91, top: 700 }], end)).toEqual([
      { line: 0, offset: 0 },
      { line: 90, offset: 800 },
    ]);
  });

  it('keeps offsets within the scrollable range and never going back', () => {
    const odd = [
      { start: 5, top: 900 },
      { start: 6, top: 10 },
    ];
    expect(buildAnchors(odd, end).map((a) => a.offset)).toEqual([0, 800, 800, 800]);
  });

  it('is just the two ends for an empty preview', () => {
    expect(buildAnchors([], end)).toEqual([
      { line: 0, offset: 0 },
      { line: 90, offset: 800 },
    ]);
  });
});

describe('offsetForLine', () => {
  it('lands exactly on a block when its first line is at the top', () => {
    expect(offsetForLine(anchors, 9)).toBe(200);
  });

  it('interpolates inside a block by line fraction', () => {
    // Halfway through the 40 lines of the table: half of the 400 px up to the next block.
    expect(offsetForLine(anchors, 29)).toBe(400);
    expect(offsetForLine(anchors, 5.5)).toBe(150);
  });

  it('interpolates after the last block up to the bottom', () => {
    expect(offsetForLine(anchors, 69.5)).toBeCloseTo(700, 9);
  });

  it('clamps outside the document', () => {
    expect(offsetForLine(anchors, -3)).toBe(0);
    expect(offsetForLine(anchors, 500)).toBe(800);
  });
});

describe('lineForOffset', () => {
  it('is the inverse of offsetForLine', () => {
    for (const line of [0, 1, 2, 5.5, 9, 29, 49, 70, 90]) {
      expect(lineForOffset(anchors, offsetForLine(anchors, line))).toBeCloseTo(line, 9);
    }
  });

  it('interpolates inside a block by pixel fraction', () => {
    expect(lineForOffset(anchors, 150)).toBe(5.5);
  });

  it('clamps outside the preview', () => {
    expect(lineForOffset(anchors, -20)).toBe(0);
    expect(lineForOffset(anchors, 5000)).toBe(90);
  });

  it('ends on the last line when the preview is scrolled to its bottom', () => {
    const flat = buildAnchors([{ start: 5, top: 800 }], end);
    expect(lineForOffset(flat, 800)).toBe(90);
    expect(lineForOffset(flat, 400)).toBe(2);
  });
});

describe('isEcho', () => {
  it('is an echo within the window after the app moved the pane', () => {
    expect(isEcho(1000 + ECHO_WINDOW_MS - 1, 1000)).toBe(true);
  });

  it('is the user once the window has passed', () => {
    expect(isEcho(1000 + ECHO_WINDOW_MS, 1000)).toBe(false);
  });
});
