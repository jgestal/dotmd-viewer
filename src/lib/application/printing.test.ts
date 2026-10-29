import { describe, expect, it } from 'vitest';
import { appError } from '../domain/errors';
import { createMemoryServices } from '../infrastructure/memory';
import { createPrinting, type PrintRequest } from './printing';

const SETUP = { size: 'a4', marginMm: 20 } as const;

const setup = () => {
  const services = createMemoryServices();
  const log: string[] = [];
  const request: PrintRequest = {
    setup: SETUP,
    prepare: async () => void log.push('prepare'),
    release: () => void log.push('release'),
  };
  const printing = createPrinting({
    dialogs: services.dialogs,
    fs: services.fs,
    printer: services.printer,
    exporter: services.pdfExporter,
    notifier: services.notifier,
    t: services.translate,
  });
  return { ...services, printing, request, log };
};

describe('print', () => {
  it('prepares the printable, then opens the print dialog and leaves the printable in place', async () => {
    const { printing, request, printer, log, notifier } = setup();
    await printing.print(request);
    expect(log).toEqual(['prepare']);
    expect(printer.printed).toBe(1);
    expect(notifier.errors).toEqual([]);
  });

  it('releases the printable and tells the user when printing fails', async () => {
    const { printing, request, printer, log, notifier } = setup();
    printer.failWith = new Error('no printer');
    await printing.print(request);
    expect(log).toEqual(['prepare', 'release']);
    expect(notifier.errors).toEqual(['error.print {"message":"no printer"}']);
  });
});

describe('exportPdf', () => {
  it('asks for a PDF named after the document, writes it and confirms', async () => {
    const { printing, request, dialogs, pdfExporter, notifier, log } = setup();
    dialogs.answerSaveFile('/out/notes.pdf');
    await printing.exportPdf('notes.md', request);
    expect(dialogs.calls).toEqual([
      {
        method: 'saveFile',
        args: ['notes.pdf', [{ name: 'filter.pdf', extensions: ['pdf'] }]],
      },
    ]);
    expect(pdfExporter.exports).toEqual([{ path: '/out/notes.pdf', page: SETUP }]);
    expect(notifier.infos).toEqual(['export.done {"name":"notes.pdf"}']);
    expect(log).toEqual(['prepare', 'release']);
  });

  it('adds the extension when the chosen name lacks it', async () => {
    const { printing, request, dialogs, pdfExporter } = setup();
    dialogs.answerSaveFile('C:\\out\\notes');
    await printing.exportPdf('notes.md', request);
    expect(pdfExporter.exports[0].path).toBe('C:\\out\\notes.pdf');
  });

  it('keeps an upper-case extension', async () => {
    const { printing, request, dialogs, pdfExporter } = setup();
    dialogs.answerSaveFile('/out/NOTES.PDF');
    await printing.exportPdf('notes.md', request);
    expect(pdfExporter.exports[0].path).toBe('/out/NOTES.PDF');
  });

  it('does nothing when the dialog is cancelled', async () => {
    const { printing, request, dialogs, pdfExporter, notifier, log } = setup();
    dialogs.answerSaveFile(null);
    await printing.exportPdf('notes.md', request);
    expect(pdfExporter.exports).toEqual([]);
    expect(notifier.infos).toEqual([]);
    expect(log).toEqual([]);
  });

  it('explains how to finish when the platform only opened the print dialog', async () => {
    const { printing, request, dialogs, pdfExporter, notifier } = setup();
    pdfExporter.outcome = 'printDialog';
    dialogs.answerSaveFile('/out/notes.pdf');
    await printing.exportPdf('notes.md', request);
    expect(notifier.infos).toEqual(['export.choosePdf {"name":"notes.pdf"}']);
  });

  it('reports a failure and still releases the printable', async () => {
    const { printing, request, dialogs, pdfExporter, notifier, log } = setup();
    pdfExporter.failWith = new Error('disk full');
    dialogs.answerSaveFile('/out/notes.pdf');
    await printing.exportPdf('notes.md', request);
    expect(notifier.errors).toEqual(['error.export {"name":"notes.pdf","message":"disk full"}']);
    expect(notifier.infos).toEqual([]);
    expect(log).toEqual(['prepare', 'release']);
  });
});

describe('exportPdfTo', () => {
  // The memory exporter records exports without writing, so the PDF is seeded to be revealed.
  it('writes the PDF without asking, confirms and shows it in the file manager', async () => {
    const { printing, request, dialogs, pdfExporter, notifier, fs, log } = setup();
    fs.seedFile('/w/notes.pdf', '');
    await printing.exportPdfTo('/w/notes.pdf', request);
    expect(dialogs.calls).toEqual([]);
    expect(pdfExporter.exports).toEqual([{ path: '/w/notes.pdf', page: SETUP }]);
    expect(notifier.infos).toEqual(['export.done {"name":"notes.pdf"}']);
    expect(fs.revealed).toEqual(['/w/notes.pdf']);
    expect(log).toEqual(['prepare', 'release']);
  });

  it('adds the extension to a destination that lacks it', async () => {
    const { printing, request, pdfExporter } = setup();
    await printing.exportPdfTo('/w/report', request);
    expect(pdfExporter.exports[0].path).toBe('/w/report.pdf');
  });

  it('still confirms when the file manager cannot show the PDF', async () => {
    const { printing, request, notifier, fs } = setup();
    fs.seedFile('/w/notes.pdf', '');
    fs.failNext('reveal', appError('io', 'no file manager'));
    await printing.exportPdfTo('/w/notes.pdf', request);
    expect(notifier.infos).toEqual(['export.done {"name":"notes.pdf"}']);
    expect(notifier.errors).toEqual([]);
    expect(fs.revealed).toEqual([]);
  });

  it('reveals nothing when the platform only opened the print dialog', async () => {
    const { printing, request, pdfExporter, notifier, fs } = setup();
    pdfExporter.outcome = 'printDialog';
    fs.seedFile('/w/notes.pdf', '');
    await printing.exportPdfTo('/w/notes.pdf', request);
    expect(notifier.infos).toEqual(['export.choosePdf {"name":"notes.pdf"}']);
    expect(fs.calls).toEqual([]);
  });

  it('reports a failure and reveals nothing', async () => {
    const { printing, request, pdfExporter, notifier, fs, log } = setup();
    pdfExporter.failWith = new Error('disk full');
    await printing.exportPdfTo('/w/notes.pdf', request);
    expect(notifier.errors).toEqual(['error.export {"name":"notes.pdf","message":"disk full"}']);
    expect(fs.calls).toEqual([]);
    expect(log).toEqual(['prepare', 'release']);
  });
});
