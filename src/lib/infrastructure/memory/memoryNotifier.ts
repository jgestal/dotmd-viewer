import type { Notifier } from '../../ports';

/** Collects the messages shown to the user. */
export class MemoryNotifier implements Notifier {
  readonly infos: string[] = [];
  readonly errors: string[] = [];

  info(message: string): void {
    this.infos.push(message);
  }

  error(message: string): void {
    this.errors.push(message);
  }
}
