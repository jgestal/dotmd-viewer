import type { PageSetup } from '../../domain/printing';
import type { ExportOutcome, PdfExporter, Printer } from '../../ports';
import { call } from './invoke';

/** The system print dialog through the `print_page` command. */
export const tauriPrinter: Printer = {
  print: () => call<void>('print_page'),
};

/** PDF written by the platform's web engine through the `export_pdf` command. */
export const tauriPdfExporter: PdfExporter = {
  async export(path: string, { size, marginMm }: PageSetup): Promise<ExportOutcome> {
    await call<void>('export_pdf', { path, pageSize: size, marginMm });
    return 'saved';
  },
};
