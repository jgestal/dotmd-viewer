import type { OpenRequests } from '../../ports';
import { call } from './invoke';
import { subscribe, type Subscription } from './subscription';

const OPEN_PATHS_EVENT = 'open-paths';

/**
 * Files the OS asked us to open. The Rust side queues requests until the frontend asks for them,
 * so `takePending` first waits for every listener to be registered: a request arriving in
 * between is then delivered as an event instead of being lost.
 */
export class TauriOpenRequests implements OpenRequests {
  private readonly subscriptions: Subscription[] = [];

  async takePending(): Promise<readonly string[]> {
    await Promise.all(this.subscriptions.map((subscription) => subscription.ready));
    return call<string[]>('take_pending_open');
  }

  onOpen(listener: (paths: readonly string[]) => void): () => void {
    const subscription = subscribe<string[]>(OPEN_PATHS_EVENT, listener);
    this.subscriptions.push(subscription);
    return subscription.unsubscribe;
  }
}
