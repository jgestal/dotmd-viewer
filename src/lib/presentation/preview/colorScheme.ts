import type { Preferences } from '$lib/domain/preferences';
import { baseScheme, type ShownTheme } from '$lib/domain/theme';

export type ColorScheme = 'light' | 'dark';

export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

/** The scheme the app shows: the chosen theme's base, or the system's when the theme follows it. */
export function effectiveScheme(theme: Preferences['theme'], systemIsDark: boolean): ColorScheme {
  return baseScheme(theme) ?? (systemIsDark ? 'dark' : 'light');
}

/** The theme an exported page is frozen in: the chosen one, or the scheme the system shows now. */
export const pageTheme = (theme: Preferences['theme'], systemIsDark: boolean): ShownTheme =>
  theme === 'system' ? effectiveScheme(theme, systemIsDark) : theme;
