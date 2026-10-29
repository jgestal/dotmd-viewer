// The maths of keeping the code editor and the preview at the same place in the document.
// Both panes are described by anchors: a fractional zero-based source line and the scroll offset
// in pixels at which that line is at the top of the pane. Between anchors positions interpolate
// linearly, so a tall block (a table, a diagram) moves the other pane in proportion.

export interface Anchor {
  /** Zero-based source line, possibly fractional. */
  readonly line: number;
  /** Scroll offset of the pane, in pixels, that puts `line` at its top. */
  readonly offset: number;
}

export interface RenderedBlock {
  /** First source line of the block, 1-based (as in `data-sourcepos`). */
  readonly start: number;
  /** Scroll offset of the pane, in pixels, that puts the block's top edge at the top. */
  readonly top: number;
}

/** A scroll event this soon after the app moved the pane itself is its echo, not the user. */
export const ECHO_WINDOW_MS = 100;

export const isEcho = (now: number, movedAt: number): boolean => now - movedAt < ECHO_WINDOW_MS;

/**
 * Anchors of a rendered pane, in document order and increasing in both line and offset. The
 * pane starts at line 0 / offset 0 and `end` is where the pane is scrolled all the way down;
 * blocks that would not fit between them (nested ones starting on the same line) are skipped.
 */
export function buildAnchors(blocks: readonly RenderedBlock[], end: Anchor): readonly Anchor[] {
  const anchors: Anchor[] = [{ line: 0, offset: 0 }];
  for (const { start, top } of blocks) {
    const previous = anchors[anchors.length - 1];
    const line = start - 1;
    if (line <= previous.line || line >= end.line) continue;
    anchors.push({ line, offset: Math.min(Math.max(top, previous.offset), end.offset) });
  }
  anchors.push(end);
  return anchors;
}

/** Piecewise linear map of `x` from the `from` values to the `to` values (both non-decreasing). */
function interpolate(from: readonly number[], to: readonly number[], x: number): number {
  const last = from.length - 1;
  if (x <= from[0]) return to[0];
  if (x >= from[last]) return to[last];
  let index = 0;
  while (from[index + 1] <= x) index++;
  const span = from[index + 1] - from[index];
  return to[index] + ((x - from[index]) / span) * (to[index + 1] - to[index]);
}

/** Scroll offset that shows the (fractional, zero-based) source line at the top of the pane. */
export const offsetForLine = (anchors: readonly Anchor[], line: number): number =>
  interpolate(
    anchors.map((a) => a.line),
    anchors.map((a) => a.offset),
    line,
  );

/** The (fractional, zero-based) source line at the top of the pane scrolled to `offset`. */
export const lineForOffset = (anchors: readonly Anchor[], offset: number): number =>
  interpolate(
    anchors.map((a) => a.offset),
    anchors.map((a) => a.line),
    offset,
  );
