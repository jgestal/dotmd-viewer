// Use cases for putting the open document on paper: the system print dialog and PDF export.
// Both print what the webview shows, so the presentation first turns the window into the
// printable document (`prepare`) and takes it down again (`release`). The print dialog may stay
// open after `print` returns, so only an export releases the printable itself.

import { toAppError } from '../domain/errors';
import { baseName } from '../domain/paths';
import { pdfFileName, type PageSetup } from '../domain/printing';
import type { Dialogs, FileFilter, Notifier, PdfExporter, Printer, Translate } from '../ports';

export interface PrintRequest {
  readonly setup: PageSetup;
  /** Shows only the printable document in the webview, fully rendered. */
  prepare(): Promise<void>;
  /** Puts the window back as it was. */
  release(): void;
}

export interface PrintingDeps {
  readonly dialogs: Dialogs;
  readonly printer: Printer;
  readonly exporter: PdfExporter;
  readonly notifier: Notifier;
  readonly t: Translate;
}

export interface Printing {
  print(request: PrintRequest): Promise<void>;
  /** Asks where to save, then writes the PDF; nothing happens when the dialog is cancelled. */
  exportPdf(documentName: string, request: PrintRequest): Promise<void>;
}

const PDF_EXTENSION = /\.pdf$/i;

const withPdfExtension = (path: string): string =>
  PDF_EXTENSION.test(path) ? path : `${path}.pdf`;

export const createPrinting = ({
  dialogs,
  printer,
  exporter,
  notifier,
  t,
}: PrintingDeps): Printing => {
  const filters = (): readonly FileFilter[] => [{ name: t('filter.pdf'), extensions: ['pdf'] }];

  const print = async (request: PrintRequest): Promise<void> => {
    try {
      await request.prepare();
      await printer.print();
    } catch (thrown) {
      request.release();
      notifier.error(t('error.print', { message: toAppError(thrown).message }));
    }
  };

  const exportPdf = async (documentName: string, request: PrintRequest): Promise<void> => {
    const chosen = await dialogs.saveFile(pdfFileName(documentName), filters());
    if (chosen === null) return;
    const path = withPdfExtension(chosen);
    const name = baseName(path);
    try {
      await request.prepare();
      const outcome = await exporter.export(path, request.setup);
      notifier.info(t(outcome === 'saved' ? 'export.done' : 'export.choosePdf', { name }));
    } catch (thrown) {
      notifier.error(t('error.export', { name, message: toAppError(thrown).message }));
    } finally {
      request.release();
    }
  };

  return { print, exportPdf };
};
