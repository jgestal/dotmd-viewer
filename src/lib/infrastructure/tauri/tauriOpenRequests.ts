import type { OpenRequest } from '../../domain/openRequests';
import type { OpenRequests } from '../../ports';
import { call } from './invoke';
import { subscribe, type Subscription } from './subscription';

const OPEN_REQUESTS_EVENT = 'open-requests';

/**
 * What the OS asked us to do (src-tauri/src/open_requests.rs). The Rust side queues requests
 * until the frontend asks for them, so `takePending` first waits for every listener to be
 * registered: a request arriving in between is then delivered as an event instead of being lost.
 */
export class TauriOpenRequests implements OpenRequests {
  private readonly subscriptions: Subscription[] = [];

  async takePending(): Promise<readonly OpenRequest[]> {
    await Promise.all(this.subscriptions.map((subscription) => subscription.ready));
    return call<OpenRequest[]>('take_pending_open');
  }

  onOpen(listener: (requests: readonly OpenRequest[]) => void): () => void {
    const subscription = subscribe<OpenRequest[]>(OPEN_REQUESTS_EVENT, listener);
    this.subscriptions.push(subscription);
    return subscription.unsubscribe;
  }
}
