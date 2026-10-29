// Use case: save the open document as one self-contained HTML page. The page itself is built by
// the presentation (it needs the DOM to render maths and diagrams) and handed in as a function.

import { toAppError } from '../domain/errors';
import { htmlFileName } from '../domain/htmlExport';
import { baseName } from '../domain/paths';
import type { Dialogs, FileFilter, FileSystem, Notifier, Translate } from '../ports';

export interface HtmlExportDeps {
  readonly dialogs: Dialogs;
  readonly fs: Pick<FileSystem, 'writeText' | 'readBase64'>;
  readonly notifier: Notifier;
  readonly t: Translate;
}

/** What building the page may read from disk: the images to embed. */
export type ImageReader = Pick<FileSystem, 'readBase64'>;

export type PageBuilder = (images: ImageReader) => Promise<string>;

export interface HtmlExport {
  /**
   * Asks where to save, with `source` (the document's path or name) as the suggestion, then
   * writes the page `build` returns; nothing happens when the dialog is cancelled.
   */
  exportHtml(source: string, build: PageBuilder): Promise<void>;
}

const HTML_EXTENSION = /\.html?$/i;

const withHtmlExtension = (path: string): string =>
  HTML_EXTENSION.test(path) ? path : `${path}.html`;

export const createHtmlExport = ({ dialogs, fs, notifier, t }: HtmlExportDeps): HtmlExport => {
  const filters = (): readonly FileFilter[] => [{ name: t('filter.html'), extensions: ['html'] }];

  const write = async (path: string, build: PageBuilder): Promise<void> => {
    const name = baseName(path);
    try {
      const content = await build(fs);
      await fs.writeText(path, { content, encoding: 'utf-8', hasBom: false });
      notifier.info(t('export.done', { name }));
    } catch (thrown) {
      notifier.error(t('error.export', { name, message: toAppError(thrown).message }));
    }
  };

  const exportHtml = async (source: string, build: PageBuilder): Promise<void> => {
    const chosen = await dialogs.saveFile(htmlFileName(source), filters());
    if (chosen !== null) await write(withHtmlExtension(chosen), build);
  };

  return { exportHtml };
};
