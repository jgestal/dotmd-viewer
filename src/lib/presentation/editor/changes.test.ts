import { describe, expect, it } from 'vitest';
import { changeBetween } from './changes';

const apply = (text: string, change: { from: number; to: number; insert: string }): string =>
  text.slice(0, change.from) + change.insert + text.slice(change.to);

describe('changeBetween', () => {
  it('reports no change for equal texts', () => {
    expect(changeBetween('same', 'same')).toBeNull();
    expect(changeBetween('', '')).toBeNull();
  });

  it('replaces only the middle that differs', () => {
    expect(changeBetween('hello world', 'hello brave world')).toEqual({
      from: 6,
      to: 6,
      insert: 'brave ',
    });
    expect(changeBetween('a cat sat', 'a dog sat')).toEqual({ from: 2, to: 5, insert: 'dog' });
  });

  it('handles deletions', () => {
    expect(changeBetween('abcdef', 'abef')).toEqual({ from: 2, to: 4, insert: '' });
  });

  it('handles an empty side', () => {
    expect(changeBetween('', 'new')).toEqual({ from: 0, to: 0, insert: 'new' });
    expect(changeBetween('old', '')).toEqual({ from: 0, to: 3, insert: '' });
  });

  it('does not let the prefix and suffix overlap on repeated characters', () => {
    expect(changeBetween('aa', 'aaa')).toEqual({ from: 2, to: 2, insert: 'a' });
    expect(changeBetween('aaa', 'aa')).toEqual({ from: 2, to: 3, insert: '' });
  });

  it('produces an edit that turns one text into the other', () => {
    const current = '# Title\n\nSome text\n';
    const next = '# Title\n\nSome more text\nand a line\n';
    expect(apply(current, changeBetween(current, next)!)).toBe(next);
  });
});
