// Sheet geometry in CSS pixels (96 per inch), so what is laid out is what prints.
import type { Preferences } from '$lib/domain/preferences';

export type PageSize = Preferences['pageSize'];

export interface SheetGeometry {
  readonly width: number;
  readonly height: number;
  readonly margin: number;
  readonly contentWidth: number;
  readonly contentHeight: number;
}

const PX_PER_MM = 96 / 25.4;
const PX_PER_INCH = 96;
const MARGIN_MM = 20;

const PAPER: Record<PageSize, { width: number; height: number }> = {
  a4: { width: 210 * PX_PER_MM, height: 297 * PX_PER_MM },
  letter: { width: 8.5 * PX_PER_INCH, height: 11 * PX_PER_INCH },
};

export function sheetGeometry(size: PageSize): SheetGeometry {
  const width = Math.round(PAPER[size].width);
  const height = Math.round(PAPER[size].height);
  const margin = Math.round(MARGIN_MM * PX_PER_MM);
  return {
    width,
    height,
    margin,
    contentWidth: width - 2 * margin,
    contentHeight: height - 2 * margin,
  };
}

/** Scale that shrinks a sheet to the available width; never enlarges it. */
export const fitScale = (availableWidth: number, sheetWidth: number): number =>
  availableWidth > 0 ? Math.min(1, availableWidth / sheetWidth) : 1;
