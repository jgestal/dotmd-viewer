import { describe, expect, it } from 'vitest';
import { effectiveScheme, pageTheme } from './colorScheme';

describe('effectiveScheme', () => {
  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
    ['sepia', 'light'],
    ['night', 'dark'],
  ] as const)('shows %s on the %s scheme whatever the system is', (theme, expected) => {
    expect(effectiveScheme(theme, true)).toBe(expected);
    expect(effectiveScheme(theme, false)).toBe(expected);
  });

  it('follows the system scheme for the system theme', () => {
    expect(effectiveScheme('system', true)).toBe('dark');
    expect(effectiveScheme('system', false)).toBe('light');
  });
});

describe('pageTheme', () => {
  it.each(['light', 'dark', 'sepia', 'night'] as const)('keeps the %s theme', (theme) => {
    expect(pageTheme(theme, true)).toBe(theme);
    expect(pageTheme(theme, false)).toBe(theme);
  });

  it('freezes the system theme as the scheme the system shows', () => {
    expect(pageTheme('system', true)).toBe('dark');
    expect(pageTheme('system', false)).toBe('light');
  });
});
