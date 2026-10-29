// The printable document: the open document rendered in the light palette and attached to <body>
// as #print-root, where print.css makes it the only thing on paper (and invisible on screen).
// Printing and PDF export both print the webview, so they first mount this and then print.
import 'katex/dist/katex.min.css';
import '../styles/document.css';
import '../styles/print.css';
import { pageRule, type PageSetup } from '$lib/domain/printing';
import type { MarkdownRenderer } from '$lib/ports';
import { measureBlocks } from '../pages/measure';
import { paginate, type PageRange } from '../pages/paginate';
import { sheetGeometry, type PageSize, type SheetGeometry } from '../pages/sheet';
import type { ImageSources } from '../preview/localImages';
import { renderDocument } from '../preview/renderDocument';

const ROOT_ID = 'print-root';
const SHEET_FONT_SIZE_PX = 15;

export interface PrintableOptions {
  /** Sheets of paper (the pages layout) rather than a continuous flow. */
  readonly paged: boolean;
  readonly pageSize: PageSize;
  readonly setup: PageSetup;
  readonly diagramErrorLabel: string;
  readonly images: ImageSources;
}

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  children: readonly Node[] = [],
): HTMLElementTagNameMap[K] => {
  const created = document.createElement(tag);
  created.className = className;
  created.append(...children);
  return created;
};

/** One sheet per page range, each with its blocks and its page number. */
export function buildSheets(
  blocks: readonly Element[],
  ranges: readonly PageRange[],
  geometry: SheetGeometry,
): HTMLElement[] {
  return ranges.map((range, index) => {
    const body = element(
      'div',
      'print-sheet-body markdown-body',
      blocks.slice(range.start, range.end),
    );
    const number = element('footer', 'print-page-number');
    number.textContent = `${index + 1} / ${ranges.length}`;
    const sheet = element('section', 'print-sheet', [body, number]);
    sheet.style.setProperty('--sheet-w', `${geometry.width}px`);
    sheet.style.setProperty('--sheet-h', `${geometry.height}px`);
    sheet.style.setProperty('--sheet-margin', `${geometry.margin}px`);
    return sheet;
  });
}

/** Lays the blocks out at the width of a sheet's content, off-screen, to learn where pages break. */
function paginateBlocks(blocks: readonly Element[], geometry: SheetGeometry): readonly PageRange[] {
  const measurer = element('div', 'markdown-body', blocks);
  measurer.setAttribute('aria-hidden', 'true');
  Object.assign(measurer.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    visibility: 'hidden',
    display: 'flow-root',
    width: `${geometry.contentWidth}px`,
    fontSize: `${SHEET_FONT_SIZE_PX}px`,
  });
  document.body.append(measurer);
  try {
    return paginate(measureBlocks(measurer, blocks), geometry.contentHeight);
  } finally {
    measurer.remove();
  }
}

function pagesOf(root: HTMLElement, pageSize: PageSize): HTMLElement[] {
  const geometry = sheetGeometry(pageSize);
  const blocks = [...root.children];
  return buildSheets(blocks, paginateBlocks(blocks, geometry), geometry);
}

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

/** Fonts (KaTeX's included) and layout have settled, so the print engine sees the final page. */
async function whenSettled(): Promise<void> {
  await document.fonts.ready;
  await nextFrame();
  await nextFrame();
}

export function unmountPrintable(): void {
  document.getElementById(ROOT_ID)?.remove();
}

/**
 * Renders `markdown` (maths and diagrams included, in the light scheme) and mounts it as the
 * printable document, replacing any earlier one. Resolves when it is ready to be printed.
 */
export async function mountPrintable(
  renderer: MarkdownRenderer,
  markdown: string,
  options: PrintableOptions,
): Promise<void> {
  const { root } = await renderDocument(renderer, markdown, {
    scheme: 'light',
    diagramErrorLabel: options.diagramErrorLabel,
    images: options.images,
  });
  const style = document.createElement('style');
  style.textContent = pageRule(options.setup);
  const content = options.paged
    ? pagesOf(root, options.pageSize)
    : [element('article', 'print-flow markdown-body', [...root.childNodes])];

  unmountPrintable();
  const printable = element('div', '', [style, ...content]);
  printable.id = ROOT_ID;
  document.body.append(printable);
  await whenSettled();
}
