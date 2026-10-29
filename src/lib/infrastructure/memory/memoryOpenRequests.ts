import type { OpenRequest } from '../../domain/openRequests';
import type { OpenRequests } from '../../ports';

type OpenListener = (requests: readonly OpenRequest[]) => void;

/** Requests from the OS: queued until taken, or delivered live to listeners. */
export class MemoryOpenRequests implements OpenRequests {
  /** Requests received before anybody listened. */
  pending: OpenRequest[] = [];

  private readonly listeners = new Set<OpenListener>();

  /** Simulates the OS asking for `requests`; with no listener they wait in `pending`. */
  emit(requests: readonly OpenRequest[]): void {
    if (this.listeners.size === 0) this.pending.push(...requests);
    else this.listeners.forEach((listener) => listener(requests));
  }

  async takePending(): Promise<readonly OpenRequest[]> {
    const taken = this.pending;
    this.pending = [];
    return taken;
  }

  onOpen(listener: OpenListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
