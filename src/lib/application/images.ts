// Brings dropped image files into a document: they are copied next to it, into `assets/`, and
// the Markdown that links them is handed back for the editor to insert.
import { toAppError } from '../domain/errors';
import { ASSETS_FOLDER, isImagePath, markdownImage } from '../domain/images';
import { baseName, dirName, joinPath } from '../domain/paths';
import type { FileSystem, Notifier, Translate } from '../ports';

export interface ImagesDeps {
  readonly fs: FileSystem;
  readonly notifier: Notifier;
  readonly t: Translate;
}

export function createImages({ fs, notifier, t }: ImagesDeps) {
  /** The copy's link, or `null` (after telling the user) when the file could not be copied. */
  async function copyAndLink(source: string, assets: string): Promise<string | null> {
    try {
      const copy = await fs.copyInto(source, assets);
      return markdownImage(`${ASSETS_FOLDER}/${baseName(copy)}`);
    } catch (thrown) {
      notifier.error(
        t('images.copyFailed', { name: baseName(source), reason: toAppError(thrown).message }),
      );
      return null;
    }
  }

  /**
   * Copies the images among `paths` into the `assets` folder next to the document at
   * `documentPath` (created when missing) and returns one image link per line, or `null` when
   * there is nothing to insert. An unsaved document has no folder yet, so the user is asked to
   * save it first.
   */
  async function importDropped(
    documentPath: string | null,
    paths: readonly string[],
  ): Promise<string | null> {
    const images = paths.filter(isImagePath);
    if (images.length === 0) return null;
    if (documentPath === null) {
      notifier.error(t('images.saveFirst'));
      return null;
    }
    const assets = joinPath(dirName(documentPath), ASSETS_FOLDER);
    try {
      await fs.ensureDir(assets);
    } catch (thrown) {
      notifier.error(toAppError(thrown).message);
      return null;
    }
    const links: string[] = [];
    for (const source of images) {
      const link = await copyAndLink(source, assets);
      if (link !== null) links.push(link);
    }
    return links.length > 0 ? links.join('\n') : null;
  }

  return { importDropped };
}

export type ImageUseCases = ReturnType<typeof createImages>;
