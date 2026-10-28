import type { Preferences } from '$lib/domain/preferences';

export type ColorScheme = 'light' | 'dark';

export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

/** The scheme the app shows: the chosen theme, or the system's when the theme follows it. */
export function effectiveScheme(theme: Preferences['theme'], systemIsDark: boolean): ColorScheme {
  if (theme === 'system') return systemIsDark ? 'dark' : 'light';
  return theme;
}
