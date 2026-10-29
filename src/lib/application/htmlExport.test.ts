import { describe, expect, it } from 'vitest';
import { appError } from '../domain/errors';
import { createMemoryServices } from '../infrastructure/memory';
import { createHtmlExport } from './htmlExport';

const setup = () => {
  const services = createMemoryServices();
  services.fs.seedFolder('/out');
  const htmlExport = createHtmlExport({
    dialogs: services.dialogs,
    fs: services.fs,
    notifier: services.notifier,
    t: services.translate,
  });
  return { ...services, htmlExport };
};

const page = async () => '<!doctype html><p>hi</p>';

describe('exportHtml', () => {
  it('suggests the document name with an .html extension, writes the page and confirms', async () => {
    const { htmlExport, dialogs, fs, notifier } = setup();
    dialogs.answerSaveFile('/out/notes.html');
    await htmlExport.exportHtml('/docs/notes.md', page);
    expect(dialogs.calls).toEqual([
      {
        method: 'saveFile',
        args: ['/docs/notes.html', [{ name: 'filter.html', extensions: ['html'] }]],
      },
    ]);
    expect(await fs.readText('/out/notes.html')).toEqual({
      content: '<!doctype html><p>hi</p>',
      encoding: 'utf-8',
      hasBom: false,
    });
    expect(notifier.infos).toEqual(['export.done {"name":"notes.html"}']);
    expect(notifier.errors).toEqual([]);
  });

  it('suggests just the name for a document that is not saved yet', async () => {
    const { htmlExport, dialogs } = setup();
    dialogs.answerSaveFile(null);
    await htmlExport.exportHtml('Untitled', page);
    expect(dialogs.calls[0].args[0]).toBe('Untitled.html');
  });

  it('hands the page builder the means to read images', async () => {
    const { htmlExport, dialogs, fs } = setup();
    fs.seedBinary('/docs/a.png', new Uint8Array([65, 66, 67]));
    dialogs.answerSaveFile('/out/a.html');
    let embedded: string | null = null;
    await htmlExport.exportHtml('/docs/a.md', async (images) => {
      embedded = await images.readBase64('/docs/a.png', 10);
      return 'x';
    });
    expect(embedded).toBe('QUJD');
  });

  it.each([
    ['/out/notes', '/out/notes.html'],
    ['C:\\out\\notes', 'C:\\out\\notes.html'],
    ['/out/notes.htm', '/out/notes.htm'],
    ['/out/NOTES.HTML', '/out/NOTES.HTML'],
    ['/out/a.html-notes', '/out/a.html-notes.html'],
  ])('writes %s as %s', async (chosen, written) => {
    const { htmlExport, dialogs, fs } = setup();
    dialogs.answerSaveFile(chosen);
    await htmlExport.exportHtml('notes.md', page);
    expect(fs.calls.at(-1)).toEqual({ method: 'writeText', args: [written] });
  });

  it('does nothing when the dialog is cancelled', async () => {
    const { htmlExport, dialogs, fs, notifier } = setup();
    dialogs.answerSaveFile(null);
    let built = false;
    await htmlExport.exportHtml('notes.md', async () => {
      built = true;
      return '';
    });
    expect(built).toBe(false);
    expect(fs.calls).toEqual([]);
    expect(notifier.infos).toEqual([]);
  });

  it('reports a write failure as an error and not as a success', async () => {
    const { htmlExport, dialogs, fs, notifier } = setup();
    fs.failNext('writeText', appError('permissionDenied', 'Permission denied', '/out/notes.html'));
    dialogs.answerSaveFile('/out/notes.html');
    await htmlExport.exportHtml('notes.md', page);
    expect(notifier.errors).toEqual([
      'error.export {"name":"notes.html","message":"Permission denied"}',
    ]);
    expect(notifier.infos).toEqual([]);
  });

  it('reports a failure to build the page and writes nothing', async () => {
    const { htmlExport, dialogs, fs, notifier } = setup();
    dialogs.answerSaveFile('/out/notes.html');
    await htmlExport.exportHtml('notes.md', async () => {
      throw new Error('render failed');
    });
    expect(notifier.errors).toEqual([
      'error.export {"name":"notes.html","message":"render failed"}',
    ]);
    expect(await fs.exists('/out/notes.html')).toBe(false);
  });
});
