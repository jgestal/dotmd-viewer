import { describe, expect, it } from 'vitest';
import { actionForKey, clampIndex, fitScale, indexAfter } from './slideControls';
import { recalledSlide, rememberSlide } from './slideMemory';

describe('clampIndex', () => {
  it('keeps indices inside the deck', () => {
    expect(clampIndex(-1, 5)).toBe(0);
    expect(clampIndex(2, 5)).toBe(2);
    expect(clampIndex(9, 5)).toBe(4);
  });
  it('is 0 for an empty deck', () => {
    expect(clampIndex(3, 0)).toBe(0);
  });
});

describe('actionForKey', () => {
  it.each([
    ['ArrowRight', false, 'next'],
    ['ArrowDown', false, 'next'],
    ['PageDown', false, 'next'],
    ['ArrowLeft', false, 'previous'],
    ['ArrowUp', false, 'previous'],
    ['PageUp', false, 'previous'],
    [' ', false, 'next'],
    [' ', true, 'previous'],
    ['Home', false, 'first'],
    ['End', false, 'last'],
    ['Escape', false, 'exit'],
  ] as const)('maps %s (shift %s) to %s', (key, shift, action) => {
    expect(actionForKey(key, shift)).toBe(action);
  });
  it('ignores other keys', () => {
    expect(actionForKey('a', false)).toBeNull();
    expect(actionForKey('Enter', false)).toBeNull();
  });
});

describe('indexAfter', () => {
  it('moves one slide and stops at the ends', () => {
    expect(indexAfter('next', 1, 4)).toBe(2);
    expect(indexAfter('next', 3, 4)).toBe(3);
    expect(indexAfter('previous', 1, 4)).toBe(0);
    expect(indexAfter('previous', 0, 4)).toBe(0);
  });
  it('jumps to the first and last slide', () => {
    expect(indexAfter('first', 2, 4)).toBe(0);
    expect(indexAfter('last', 1, 4)).toBe(3);
    expect(indexAfter('last', 0, 0)).toBe(0);
  });
  it('stays on exit', () => {
    expect(indexAfter('exit', 2, 4)).toBe(2);
  });
});

describe('fitScale', () => {
  it('is limited by the tighter side', () => {
    expect(fitScale(640, 1000)).toBe(0.5);
    expect(fitScale(2560, 360)).toBe(0.5);
    expect(fitScale(1280, 720)).toBe(1);
  });
  it('is 0 without room', () => {
    expect(fitScale(-10, 100)).toBe(0);
  });
});

describe('slide memory', () => {
  it('recalls the slide per document', () => {
    rememberSlide('/a.md', 3);
    expect(recalledSlide('/a.md')).toBe(3);
    expect(recalledSlide('/b.md')).toBeNull();
  });
  it('does not remember untitled documents', () => {
    rememberSlide(null, 2);
    expect(recalledSlide(null)).toBeNull();
  });
});
