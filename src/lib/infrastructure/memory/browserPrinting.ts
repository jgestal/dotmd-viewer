import type { ExportOutcome, PdfExporter, Printer } from '../../ports';

/** In a plain browser, printing is the browser's own print dialog. */
export class BrowserPrinter implements Printer {
  async print(): Promise<void> {
    window.print();
  }
}

/** A browser cannot write files silently: the PDF is made from the print dialog. */
export class BrowserPdfExporter implements PdfExporter {
  async export(): Promise<ExportOutcome> {
    window.print();
    return 'printDialog';
  }
}
