import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { debounced, type Debounced } from './debounced.svelte';

const DELAY_MS = 250;

// Rune state needs an effect root, and the source is a reactive box the test changes.
function setup() {
  const box = $state({ text: 'a', tab: 1 });
  let value!: Debounced<string>;
  const dispose = $effect.root(() => {
    value = debounced(
      () => box.text,
      DELAY_MS,
      () => box.tab,
    );
  });
  flushSync();
  return { box, value: () => value.current, dispose };
}

describe('debounced', () => {
  let dispose = () => {};

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    dispose();
    vi.useRealTimers();
  });

  it('starts with the current value of the source', () => {
    const t = setup();
    dispose = t.dispose;
    expect(t.value()).toBe('a');
  });

  it('follows a change only after the delay has passed', () => {
    const t = setup();
    dispose = t.dispose;
    t.box.text = 'b';
    flushSync();
    vi.advanceTimersByTime(DELAY_MS - 1);
    expect(t.value()).toBe('a');
    vi.advanceTimersByTime(1);
    expect(t.value()).toBe('b');
  });

  it('restarts the delay on every change, so only the last value after a pause is kept', () => {
    const t = setup();
    dispose = t.dispose;
    t.box.text = 'b';
    flushSync();
    vi.advanceTimersByTime(200);
    t.box.text = 'c';
    flushSync();
    vi.advanceTimersByTime(200);
    expect(t.value()).toBe('a');
    vi.advanceTimersByTime(50);
    expect(t.value()).toBe('c');
  });

  it('follows at once when the scope changes, without waiting for the delay', () => {
    const t = setup();
    dispose = t.dispose;
    t.box.text = 'b';
    t.box.tab = 2;
    flushSync();
    expect(t.value()).toBe('b');
  });
});
