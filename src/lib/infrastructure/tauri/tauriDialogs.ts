import { ask, message, open, save } from '@tauri-apps/plugin-dialog';
import type { Dialogs, FileFilter, Translate, UnsavedChoice } from '../../ports';
import { attempt } from './invoke';

const toDialogFilters = (filters: readonly FileFilter[]) =>
  filters.map(({ name, extensions }) => ({ name, extensions: [...extensions] }));

/** Native dialogs of plugin-dialog; the unsaved-changes texts come from `t`. */
export class TauriDialogs implements Dialogs {
  constructor(private readonly t: Translate) {}

  openFile(filters: readonly FileFilter[]): Promise<string | null> {
    return attempt(() =>
      open({ multiple: false, directory: false, filters: toDialogFilters(filters) }),
    );
  }

  openFolder(): Promise<string | null> {
    return attempt(() => open({ multiple: false, directory: true }));
  }

  saveFile(defaultPath: string, filters: readonly FileFilter[]): Promise<string | null> {
    return attempt(() => save({ defaultPath, filters: toDialogFilters(filters) }));
  }

  async askUnsaved(fileName: string): Promise<UnsavedChoice> {
    const { t } = this;
    const labels = {
      yes: t('dialog.unsaved.save'),
      no: t('dialog.unsaved.discard'),
      cancel: t('dialog.unsaved.cancel'),
    };
    const answer = await attempt(() =>
      message(t('dialog.unsaved.message', { name: fileName }), {
        title: t('dialog.unsaved.title'),
        kind: 'warning',
        buttons: labels,
      }),
    );
    if (answer === labels.yes) return 'save';
    return answer === labels.no ? 'discard' : 'cancel';
  }

  confirm(title: string, text: string, ok: string, cancel: string): Promise<boolean> {
    return attempt(() => ask(text, { title, kind: 'warning', okLabel: ok, cancelLabel: cancel }));
  }

  async alert(title: string, text: string): Promise<void> {
    await attempt(() => message(text, { title, kind: 'error' }));
  }
}
