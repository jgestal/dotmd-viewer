import { isPageBreakText, type PageBlock } from './paginate';

const HEADING = /^H[1-6]$/;

const topOf = (block: Element): number | null => block.getClientRects()[0]?.top ?? null;

/**
 * Heights of the blocks as laid out inside `container` (which must be attached, at the width of
 * a sheet's content and containing exactly `blocks`). A block's height runs to the top of the
 * next one, so the margin between them counts; blocks with no box (display: none) take none.
 */
export function measureBlocks(container: HTMLElement, blocks: readonly Element[]): PageBlock[] {
  const tops = blocks.map(topOf);
  const bottom = container.getBoundingClientRect().bottom;
  return blocks.map((block, index) => {
    const top = tops[index];
    const next = tops.slice(index + 1).find((candidate) => candidate !== null) ?? bottom;
    return {
      height: top === null ? 0 : next - top,
      keepWithNext: HEADING.test(block.tagName),
      pageBreak: block.tagName === 'P' && isPageBreakText(block.textContent ?? ''),
    };
  });
}
