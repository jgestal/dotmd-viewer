// Display themes and the light or dark base each one is built on.

export const THEMES = ['system', 'light', 'dark', 'sepia', 'night'] as const;

export type Theme = (typeof THEMES)[number];

/** A theme that fixes the look by itself, i.e. every theme but `system`. */
export type ShownTheme = Exclude<Theme, 'system'>;

export type BaseScheme = 'light' | 'dark';

const BASES: Readonly<Record<ShownTheme, BaseScheme>> = {
  light: 'light',
  dark: 'dark',
  sepia: 'light',
  night: 'dark',
};

/** The scheme a theme is built on; `null` for the system theme, which follows the OS. */
export const baseScheme = (theme: Theme): BaseScheme | null =>
  theme === 'system' ? null : BASES[theme];

/** The theme after `theme` in the order of `THEMES`, wrapping around. */
export const nextTheme = (theme: Theme): Theme =>
  THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
