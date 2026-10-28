import type { OpenRequests } from '../../ports';

type OpenListener = (paths: readonly string[]) => void;

/** Open-file requests from the OS: queued until taken, or delivered live to listeners. */
export class MemoryOpenRequests implements OpenRequests {
  /** Requests received before anybody listened. */
  pending: string[] = [];

  private readonly listeners = new Set<OpenListener>();

  /** Simulates the OS asking to open `paths`; with no listener they wait in `pending`. */
  emit(paths: readonly string[]): void {
    if (this.listeners.size === 0) this.pending.push(...paths);
    else this.listeners.forEach((listener) => listener(paths));
  }

  async takePending(): Promise<readonly string[]> {
    const taken = this.pending;
    this.pending = [];
    return taken;
  }

  onOpen(listener: OpenListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
