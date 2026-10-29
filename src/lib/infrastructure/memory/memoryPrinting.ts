import type { PageSetup } from '../../domain/printing';
import type { ExportOutcome, PdfExporter, Printer } from '../../ports';

/** Counts print requests; `failWith` makes the next ones reject. */
export class MemoryPrinter implements Printer {
  printed = 0;
  failWith: Error | null = null;

  async print(): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.printed++;
  }
}

/** Records the exports it was asked for; `outcome` and `failWith` script the answer. */
export class MemoryPdfExporter implements PdfExporter {
  readonly exports: { readonly path: string; readonly page: PageSetup }[] = [];
  outcome: ExportOutcome = 'saved';
  failWith: Error | null = null;

  async export(path: string, page: PageSetup): Promise<ExportOutcome> {
    if (this.failWith) throw this.failWith;
    this.exports.push({ path, page });
    return this.outcome;
  }
}
