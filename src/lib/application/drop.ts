// Decides what files and folders handed to the app (dropped on the window, or requested by the OS)
// should open. The file system says what each path is; the user hears about whatever is skipped.
import { baseName, isMarkdownPath } from '../domain/paths';
import type { FileSystem, Notifier, Translate } from '../ports';

export interface DropDeps {
  readonly fs: FileSystem;
  readonly notifier: Notifier;
  readonly t: Translate;
}

/** What to open: a folder becomes the explorer root and a document is shown; either may be absent. */
export interface OpenPlan {
  readonly folder: string | null;
  readonly file: string | null;
}

const last = <T>(items: readonly T[]): T | null => items[items.length - 1] ?? null;

export function createDrop({ fs, notifier, t }: DropDeps) {
  /** The last folder and the last Markdown file among `paths`; everything else is reported. */
  async function plan(paths: readonly string[]): Promise<OpenPlan> {
    const kinds = await Promise.all(paths.map((path) => fs.kind(path)));
    const folders = paths.filter((_, index) => kinds[index] === 'folder');
    const documents = paths.filter(
      (path, index) => kinds[index] === 'file' && isMarkdownPath(path),
    );
    const folder = last(folders);
    const file = last(documents);
    const skipped = paths.length - [folder, file].filter((chosen) => chosen !== null).length;
    reportSkipped(folder, file, skipped);
    return { folder, file };
  }

  function reportSkipped(folder: string | null, file: string | null, skipped: number): void {
    if (skipped === 0) return;
    const opened = file ?? folder;
    if (opened === null) notifier.error(t('drop.rejected'));
    else notifier.info(t('drop.skipped', { name: baseName(opened), count: skipped }));
  }

  return { plan };
}

export type DropUseCases = ReturnType<typeof createDrop>;
