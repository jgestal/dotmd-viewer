import { blockForLine, parseStartLine, topLineAt } from './sourcePositions';

// Scrolling a rendered document by source line, shared by the continuous, paged and editable
// views. A view lists its blocks with the 1-based source line each starts at.

const TOP_TOLERANCE_PX = 4;

export interface LineBlock {
  readonly element: Element;
  /** First source line of the block, 1-based. */
  readonly start: number;
}

const sourceBlocks = (root: Element): LineBlock[] =>
  [...root.querySelectorAll('[data-sourcepos]')].flatMap((element) => {
    const start = parseStartLine(element.getAttribute('data-sourcepos'));
    return start === null ? [] : [{ element, start }];
  });

/** Scrolls so the block of the zero-based source line is at the top. False if there is none yet. */
export function revealBlockLine(
  scroller: HTMLElement,
  blocks: readonly LineBlock[],
  line: number,
): boolean {
  const block = blockForLine(blocks, line);
  if (!block) return false;
  scroller.scrollTop +=
    block.element.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  return true;
}

/** Zero-based source line of the block at the top of the scroller. */
export function topBlockLine(scroller: HTMLElement, blocks: readonly LineBlock[]): number {
  const edge = scroller.getBoundingClientRect().top;
  const tops = blocks.map(({ element, start }) => ({
    start,
    top: element.getBoundingClientRect().top - edge,
  }));
  return topLineAt(tops, TOP_TOLERANCE_PX);
}

/** Every block of the rendered document with its scroll offset in the scroller. */
export function blockOffsets(
  scroller: HTMLElement,
  root: Element,
): readonly { start: number; top: number }[] {
  const edge = scroller.getBoundingClientRect().top - scroller.scrollTop;
  return sourceBlocks(root).map(({ element, start }) => ({
    start,
    top: element.getBoundingClientRect().top - edge,
  }));
}

/** `revealBlockLine` over the rendered blocks of `root`. */
export const revealLine = (scroller: HTMLElement, root: Element, line: number): boolean =>
  revealBlockLine(scroller, sourceBlocks(root), line);

/** `topBlockLine` over the rendered blocks of `root`. */
export const topLine = (scroller: HTMLElement, root: Element): number =>
  topBlockLine(scroller, sourceBlocks(root));
