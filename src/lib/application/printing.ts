// Use cases for putting the open document on paper: the system print dialog and PDF export.
// Both print what the webview shows, so the presentation first turns the window into the
// printable document (`prepare`) and takes it down again (`release`). The print dialog may stay
// open after `print` returns, so only an export releases the printable itself.

import { toAppError } from '../domain/errors';
import { baseName } from '../domain/paths';
import { pdfFileName, type PageSetup } from '../domain/printing';
import type {
  Dialogs,
  FileFilter,
  FileSystem,
  Notifier,
  PdfExporter,
  Printer,
  Translate,
} from '../ports';

export interface PrintRequest {
  readonly setup: PageSetup;
  /** Shows only the printable document in the webview, fully rendered. */
  prepare(): Promise<void>;
  /** Puts the window back as it was. */
  release(): void;
}

export interface PrintingDeps {
  readonly dialogs: Dialogs;
  /** Shows an exported file in the file manager. */
  readonly fs: Pick<FileSystem, 'reveal'>;
  readonly printer: Printer;
  readonly exporter: PdfExporter;
  readonly notifier: Notifier;
  readonly t: Translate;
}

export interface Printing {
  print(request: PrintRequest): Promise<void>;
  /** Asks where to save, then writes the PDF; nothing happens when the dialog is cancelled. */
  exportPdf(documentName: string, request: PrintRequest): Promise<void>;
  /**
   * Writes the PDF to `path` without asking (the file manager's "Export to PDF"), then shows it
   * in the file manager.
   */
  exportPdfTo(path: string, request: PrintRequest): Promise<void>;
}

const PDF_EXTENSION = /\.pdf$/i;

const withPdfExtension = (path: string): string =>
  PDF_EXTENSION.test(path) ? path : `${path}.pdf`;

export const createPrinting = ({
  dialogs,
  fs,
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
    if (chosen !== null) await write(withPdfExtension(chosen), request);
  };

  const exportPdfTo = async (path: string, request: PrintRequest): Promise<void> => {
    const written = withPdfExtension(path);
    if (await write(written, request)) await revealQuietly(written);
  };

  /** Exports to `path` and says how it went; true when the file was written. */
  const write = async (path: string, request: PrintRequest): Promise<boolean> => {
    const name = baseName(path);
    try {
      await request.prepare();
      const outcome = await exporter.export(path, request.setup);
      notifier.info(t(outcome === 'saved' ? 'export.done' : 'export.choosePdf', { name }));
      return outcome === 'saved';
    } catch (thrown) {
      notifier.error(t('error.export', { name, message: toAppError(thrown).message }));
      return false;
    } finally {
      request.release();
    }
  };

  /** The PDF is written and the toast says where: a file manager that fails to open is no error. */
  const revealQuietly = (path: string): Promise<void> => fs.reveal(path).catch(() => undefined);

  return { print, exportPdf, exportPdfTo };
};
