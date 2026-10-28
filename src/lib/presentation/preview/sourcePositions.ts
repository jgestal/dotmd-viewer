// Maps between rendered blocks and source lines through the `data-sourcepos="l:c-l:c"` attribute
// the renderer puts on every block (1-based lines).

export interface SourceBlock {
  /** First source line of the block, 1-based. */
  readonly start: number;
  /** Distance of the block's top edge from the top of the scrolling view, in pixels. */
  readonly top: number;
}

const START_LINE = /^(\d+):/;

/** First line of a `data-sourcepos` value, or `null` when it does not parse. */
export const parseStartLine = (sourcepos: string | null): number | null => {
  const match = START_LINE.exec(sourcepos ?? '');
  return match ? Number(match[1]) : null;
};

/**
 * The block to scroll to for a zero-based source line: the one starting at the greatest line not
 * after it (the outermost when several start together), or the first block if none does.
 */
export const blockForLine = <T extends { readonly start: number }>(
  blocks: readonly T[],
  line: number,
): T | null => {
  let best: T | null = null;
  for (const block of blocks) {
    if (block.start <= line + 1 && (best === null || block.start > best.start)) best = block;
  }
  return best ?? blocks[0] ?? null;
};

/** Zero-based source line of the last block whose top edge is at or above `y`. */
export const topLineAt = (blocks: readonly SourceBlock[], y: number): number => {
  let line = 0;
  for (const block of blocks) {
    if (block.top <= y) line = block.start - 1;
  }
  return line;
};
