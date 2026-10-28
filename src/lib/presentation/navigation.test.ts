import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lineAtOffset, offsetOfLine, throttle } from './navigation';
import { navigation } from './navigation.svelte';

describe('line and offset maths', () => {
  it('maps a scroll offset to the zero-based line at the top', () => {
    expect(lineAtOffset(0, 20)).toBe(0);
    expect(lineAtOffset(19, 20)).toBe(0);
    expect(lineAtOffset(20, 20)).toBe(1);
    expect(lineAtOffset(105, 20)).toBe(5);
  });

  it('never returns a negative line (overscroll)', () => {
    expect(lineAtOffset(-30, 20)).toBe(0);
  });

  it('maps a line to its scroll offset', () => {
    expect(offsetOfLine(0, 20)).toBe(0);
    expect(offsetOfLine(5, 20)).toBe(100);
    expect(offsetOfLine(-3, 20)).toBe(0);
  });
});

describe('throttle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs the first call at once and ignores calls during the pause', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled(1);
    throttled(2);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(1);
  });

  it('delivers the latest arguments after the pause', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled(1);
    throttled(2);
    throttled(3);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(3);
  });

  it('accepts a new call at once after a quiet pause', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled(1);
    vi.advanceTimersByTime(100);
    throttled(2);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(2);
  });
});

describe('navigation channel', () => {
  it('starts at the top', () => {
    expect(navigation.topLine).toBe(0);
  });

  it('issues reveal requests with an incrementing id, even for the same line', () => {
    navigation.revealLine(12);
    const first = navigation.reveal;
    navigation.revealLine(12);
    const second = navigation.reveal;
    expect(first?.line).toBe(12);
    expect(second?.line).toBe(12);
    expect(second!.id).toBe(first!.id + 1);
  });

  it('stores the top line reported by the visible view', () => {
    navigation.reportTopLine(42);
    expect(navigation.topLine).toBe(42);
  });
});
