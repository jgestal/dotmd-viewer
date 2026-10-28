import type { Dialogs, FileFilter, UnsavedChoice } from '../../ports';

interface Answers {
  openFile: string | null;
  openFolder: string | null;
  saveFile: string | null;
  askUnsaved: UnsavedChoice;
  confirm: boolean;
  alert: undefined;
}

export type DialogMethod = keyof Answers;

export interface DialogCall {
  readonly method: DialogMethod;
  readonly args: readonly unknown[];
}

/** Dialogs that answer from a script: queue answers first, then run the code under test. */
export class MemoryDialogs implements Dialogs {
  /** Every dialog shown, with the arguments it was asked with, in order. */
  readonly calls: DialogCall[] = [];

  private readonly queues: { [K in DialogMethod]: Answers[K][] } = {
    openFile: [],
    openFolder: [],
    saveFile: [],
    askUnsaved: [],
    confirm: [],
    alert: [],
  };

  answerOpenFile(path: string | null): void {
    this.queues.openFile.push(path);
  }

  answerOpenFolder(path: string | null): void {
    this.queues.openFolder.push(path);
  }

  answerSaveFile(path: string | null): void {
    this.queues.saveFile.push(path);
  }

  answerAskUnsaved(choice: UnsavedChoice): void {
    this.queues.askUnsaved.push(choice);
  }

  answerConfirm(accepted: boolean): void {
    this.queues.confirm.push(accepted);
  }

  /** Lets one `alert` call through. */
  answerAlert(): void {
    this.queues.alert.push(undefined);
  }

  async openFile(filters: readonly FileFilter[]): Promise<string | null> {
    return this.next('openFile', [filters]);
  }

  async openFolder(): Promise<string | null> {
    return this.next('openFolder', []);
  }

  async saveFile(defaultPath: string, filters: readonly FileFilter[]): Promise<string | null> {
    return this.next('saveFile', [defaultPath, filters]);
  }

  async askUnsaved(fileName: string): Promise<UnsavedChoice> {
    return this.next('askUnsaved', [fileName]);
  }

  async confirm(title: string, message: string, ok: string, cancel: string): Promise<boolean> {
    return this.next('confirm', [title, message, ok, cancel]);
  }

  async alert(title: string, message: string): Promise<void> {
    this.next('alert', [title, message]);
  }

  private next<K extends DialogMethod>(method: K, args: readonly unknown[]): Answers[K] {
    this.calls.push({ method, args });
    const queue = this.queues[method];
    if (queue.length === 0) {
      throw new Error(`MemoryDialogs.${method} was called without a scripted answer`);
    }
    return queue.shift() as Answers[K];
  }
}
