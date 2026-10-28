import { listen } from '@tauri-apps/api/event';
import { attempt } from './invoke';

/**
 * Listens to a Tauri event. Registration is asynchronous, so `ready` settles once the listener
 * is in place and `unsubscribe` is safe to call at any time, even before that.
 */
export interface Subscription {
  readonly ready: Promise<void>;
  unsubscribe(): void;
}

export const subscribe = <T>(event: string, handler: (payload: T) => void): Subscription => {
  const unlisten = attempt(() => listen<T>(event, (received) => handler(received.payload)));
  return {
    ready: unlisten.then(() => undefined),
    unsubscribe: () => void unlisten.then((stop) => stop()).catch(() => undefined),
  };
};
