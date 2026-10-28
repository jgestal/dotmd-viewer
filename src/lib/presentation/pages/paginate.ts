// Pure pagination: which top-level blocks of the rendered document go on which sheet.
//
// Rules: blocks keep their order; a block that does not fit starts the next sheet; a block that
// asks to stay with the next one (a heading) is never left alone at the bottom of a sheet; a
// block taller than a whole sheet gets a sheet of its own (it overflows rather than splits); a
// page break block ends the sheet and takes no room itself.

export interface PageBlock {
  /** Height the block takes in the flow, margins included, in pixels. */
  readonly height: number;
  /** Stays on the same sheet as the block after it (headings). */
  readonly keepWithNext: boolean;
  /** A manual page break: starts a new sheet, shows nothing. */
  readonly pageBreak: boolean;
}

/** Blocks `start` (inclusive) to `end` (exclusive) of one sheet; page breaks are left out. */
export interface PageRange {
  readonly start: number;
  readonly end: number;
}

/** Marks a manual page break: a paragraph holding only this text (`\pagebreak` on its own line). */
export const PAGE_BREAK_MARKER = '\\pagebreak';

export const isPageBreakText = (text: string): boolean => text.trim() === PAGE_BREAK_MARKER;

interface Unit extends PageRange {
  readonly height: number;
}

const heightOf = (blocks: readonly PageBlock[], start: number, end: number): number =>
  blocks.slice(start, end).reduce((sum, block) => sum + block.height, 0);

/** Groups each run of keep-with-next blocks with the block that follows it. */
function unitsBetween(
  blocks: readonly PageBlock[],
  from: number,
  to: number,
  keepHeadings = true,
): Unit[] {
  const units: Unit[] = [];
  let start = from;
  for (let i = from; i < to; i++) {
    if (keepHeadings && blocks[i].keepWithNext && i + 1 < to) continue;
    units.push({ start, end: i + 1, height: heightOf(blocks, start, i + 1) });
    start = i + 1;
  }
  return units;
}

/** Units of a run; a group that could never fit a sheet is dissolved into single blocks. */
function fittingUnits(
  blocks: readonly PageBlock[],
  from: number,
  to: number,
  pageHeight: number,
): Unit[] {
  return unitsBetween(blocks, from, to).flatMap((unit) =>
    unit.end - unit.start > 1 && unit.height > pageHeight
      ? unitsBetween(blocks, unit.start, unit.end, false)
      : [unit],
  );
}

function paginateRun(
  blocks: readonly PageBlock[],
  from: number,
  to: number,
  pageHeight: number,
): PageRange[] {
  const pages: PageRange[] = [];
  let current: Unit | null = null;
  for (const unit of fittingUnits(blocks, from, to, pageHeight)) {
    if (current && current.height + unit.height <= pageHeight) {
      current = { start: current.start, end: unit.end, height: current.height + unit.height };
      continue;
    }
    if (current) pages.push({ start: current.start, end: current.end });
    current = unit;
  }
  if (current) pages.push({ start: current.start, end: current.end });
  return pages;
}

/** Index ranges of the blocks on each sheet. A document with nothing to show gets one empty sheet. */
export function paginate(blocks: readonly PageBlock[], pageHeight: number): readonly PageRange[] {
  const pages: PageRange[] = [];
  let runStart = 0;
  for (let i = 0; i <= blocks.length; i++) {
    if (i < blocks.length && !blocks[i].pageBreak) continue;
    pages.push(...paginateRun(blocks, runStart, i, pageHeight));
    runStart = i + 1;
  }
  return pages.length > 0 ? pages : [{ start: 0, end: 0 }];
}
