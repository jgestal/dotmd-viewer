import { describe, expect, it } from 'vitest';
import { clampRatio, DEFAULT_RATIO, MIN_PANE_PX } from './splitRatio';

describe('clampRatio', () => {
  it('keeps a ratio that leaves both panes wide enough', () => {
    expect(clampRatio(0.4, 1000)).toBe(0.4);
  });

  it('keeps the first pane at its minimum width', () => {
    expect(clampRatio(0.05, 1000)).toBe(MIN_PANE_PX / 1000);
  });

  it('keeps the second pane at its minimum width', () => {
    expect(clampRatio(0.99, 1000)).toBe(1 - MIN_PANE_PX / 1000);
  });

  it('splits evenly when there is no room for two minimum panes', () => {
    expect(clampRatio(0.9, 2 * MIN_PANE_PX - 1)).toBe(DEFAULT_RATIO);
  });

  it('allows exactly two minimum panes', () => {
    expect(clampRatio(0.9, 2 * MIN_PANE_PX)).toBe(0.5);
  });
});
