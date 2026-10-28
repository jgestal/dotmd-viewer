import { describe, expect, it } from 'vitest';
import { blockForLine, parseStartLine, topLineAt } from './sourcePositions';

describe('parseStartLine', () => {
  it('reads the first line of a source position', () => {
    expect(parseStartLine('12:1-15:4')).toBe(12);
  });

  it('returns null for missing or malformed values', () => {
    expect(parseStartLine(null)).toBeNull();
    expect(parseStartLine('')).toBeNull();
    expect(parseStartLine('x:1-2:3')).toBeNull();
  });
});

describe('blockForLine', () => {
  const blocks = [{ start: 1 }, { start: 5 }, { start: 5 }, { start: 9 }];

  it('picks the block starting exactly at the (zero-based) line', () => {
    expect(blockForLine(blocks, 4)).toBe(blocks[1]);
  });

  it('picks the closest block before the line, the outermost on ties', () => {
    expect(blockForLine(blocks, 7)).toBe(blocks[1]);
    expect(blockForLine(blocks, 100)).toBe(blocks[3]);
  });

  it('falls back to the first block, or null without blocks', () => {
    expect(blockForLine([{ start: 4 }], 0)).toEqual({ start: 4 });
    expect(blockForLine([], 3)).toBeNull();
  });
});

describe('topLineAt', () => {
  const blocks = [
    { start: 1, top: -300 },
    { start: 6, top: -40 },
    { start: 10, top: 20 },
  ];

  it('returns the zero-based start of the last block at or above the edge', () => {
    expect(topLineAt(blocks, 0)).toBe(5);
    expect(topLineAt(blocks, 20)).toBe(9);
  });

  it('is zero when no block has reached the edge or there are none', () => {
    expect(topLineAt(blocks, -500)).toBe(0);
    expect(topLineAt([], 0)).toBe(0);
  });
});
