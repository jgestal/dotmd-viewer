import { describe, expect, it } from 'vitest';
import { effectiveScheme } from './colorScheme';

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
