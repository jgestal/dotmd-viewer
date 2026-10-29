import { describe, expect, it } from 'vitest';
import { baseScheme, nextTheme, THEMES } from './theme';

describe('baseScheme', () => {
  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
    ['sepia', 'light'],
    ['night', 'dark'],
  ] as const)('builds %s on the %s scheme', (theme, expected) => {
    expect(baseScheme(theme)).toBe(expected);
  });

  it('has no base for the system theme, which follows the OS', () => {
    expect(baseScheme('system')).toBeNull();
  });
});

describe('nextTheme', () => {
  it('lists the themes in the order they are cycled', () => {
    expect(THEMES).toEqual(['system', 'light', 'dark', 'sepia', 'night']);
  });

  it.each([
    ['system', 'light'],
    ['light', 'dark'],
    ['dark', 'sepia'],
    ['sepia', 'night'],
    ['night', 'system'],
  ] as const)('moves from %s to %s', (theme, expected) => {
    expect(nextTheme(theme)).toBe(expected);
  });
});
