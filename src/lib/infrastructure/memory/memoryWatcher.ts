import { isSamePath } from '../../domain/paths';
import type { FileWatcher } from '../../ports';
import type { MemoryFileSystem } from './memoryFileSystem';

/** Reports external writes of the file being watched, as the file system double sees them. */
export class MemoryWatcher implements FileWatcher {
  /** The path being watched now, or `null`. */
  watched: string | null = null;
  /** Every argument `watch` received, in order. */
  readonly watchCalls: (string | null)[] = [];

  private readonly listeners = new Set<(path: string) => void>();

  constructor(fileSystem: MemoryFileSystem) {
    fileSystem.onExternalWrite((path) => {
      if (this.watched !== null && isSamePath(this.watched, path)) this.emit(path);
    });
  }

  async watch(path: string | null): Promise<void> {
    this.watchCalls.push(path);
    this.watched = path;
  }

  onChange(listener: (path: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(path: string): void {
    this.listeners.forEach((listener) => listener(path));
  }
}
