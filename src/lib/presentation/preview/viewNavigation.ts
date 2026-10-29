import { blockForLine, parseStartLine, topLineAt } from './sourcePositions';

// Scrolling a rendered document by source line, shared by the continuous and the paged views.

const TOP_TOLERANCE_PX = 4;

const sourceBlocks = (root: Element) =>
  [...root.querySelectorAll('[data-sourcepos]')].flatMap((element) => {
    const start = parseStartLine(element.getAttribute('data-sourcepos'));
    return start === null ? [] : [{ element, start }];
  });

/** Scrolls so the block of the zero-based source line is at the top. False if there is none yet. */
export function revealLine(scroller: HTMLElement, root: Element, line: number): boolean {
  const block = blockForLine(sourceBlocks(root), line);
  if (!block) return false;
  scroller.scrollTop +=
    block.element.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  return true;
}

/** Zero-based source line of the block at the top of the scroller. */
export function topLine(scroller: HTMLElement, root: Element): number {
  const edge = scroller.getBoundingClientRect().top;
  const blocks = sourceBlocks(root).map(({ element, start }) => ({
    start,
    top: element.getBoundingClientRect().top - edge,
  }));
  return topLineAt(blocks, TOP_TOLERANCE_PX);
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
