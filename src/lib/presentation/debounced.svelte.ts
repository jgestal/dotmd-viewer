// A value that follows `source` only once it has stopped changing for `delayMs`. When `scope`
// changes (say, another document opened) the value follows at once instead of after the delay.
import { untrack } from 'svelte';

export interface Debounced<T> {
  readonly current: T;
}

export function debounced<T>(
  source: () => T,
  delayMs: number,
  scope: () => unknown = () => undefined,
): Debounced<T> {
  let value = $state(untrack(source));
  let scopeSeen = untrack(scope);

  $effect(() => {
    const next = source();
    const nextScope = scope();
    if (nextScope !== scopeSeen) {
      scopeSeen = nextScope;
      value = next;
      return;
    }
    const timer = setTimeout(() => {
      value = next;
    }, delayMs);
    return () => clearTimeout(timer);
  });

  return {
    get current() {
      return value;
    },
  };
}
