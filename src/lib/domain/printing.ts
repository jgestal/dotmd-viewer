// How a document is put on paper: paper size and margins per layout, the `@page` rule that
// asks the print engine for them, and the default name of an exported PDF.
import { withoutMarkdownExtension } from './paths';
import type { Preferences } from './preferences';

export type PaperSize = Preferences['pageSize'];

/** What the print engine is asked for. Margins are in millimetres. */
export interface PageSetup {
  readonly size: PaperSize;
  readonly marginMm: number;
}

/** Margin of the continuous flow; the pages layout draws its own margins inside each sheet. */
export const FLOW_MARGIN_MM = 20;

const PAPER_NAME: Record<PaperSize, string> = { a4: 'A4', letter: 'letter' };

/** Sheets are printed edge to edge (they carry their own margin); any other layout flows with margins. */
export const pageSetupFor = (layout: Preferences['layout'], size: PaperSize): PageSetup => ({
  size,
  marginMm: layout === 'pages' ? 0 : FLOW_MARGIN_MM,
});

export const pageRule = ({ size, marginMm }: PageSetup): string =>
  `@page { size: ${PAPER_NAME[size]}; margin: ${marginMm}mm; }`;

/** `notes.md` → `notes.pdf`; the name is used as is when it has no Markdown extension. */
export const pdfFileName = (documentName: string): string =>
  `${withoutMarkdownExtension(documentName)}.pdf`;
