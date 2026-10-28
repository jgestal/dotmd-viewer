import type { ExternalOpener } from '../../ports';

/** Remembers the addresses the app asked to open. */
export class MemoryOpener implements ExternalOpener {
  /** Every address, in order. */
  readonly opened: string[] = [];

  async openExternal(url: string): Promise<void> {
    this.opened.push(url);
  }
}
