import type { OsRecents } from '../../ports';

/** Remembers what the app told the system about recent documents. */
export class MemoryOsRecents implements OsRecents {
  /** Paths announced, in order, since the last clear. */
  readonly paths: string[] = [];

  async add(path: string): Promise<void> {
    this.paths.push(path);
  }

  async clear(): Promise<void> {
    this.paths.length = 0;
  }
}
