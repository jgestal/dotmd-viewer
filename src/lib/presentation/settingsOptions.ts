// The choices the settings dialog offers, as plain data so they can be tested without a DOM.
import type { Preferences } from '$lib/domain/preferences';

export interface Option<T extends string> {
  readonly value: T;
  /** i18n key of the visible label. */
  readonly label: string;
}

export const languageOptions: readonly Option<Preferences['language']>[] = [
  { value: 'system', label: 'settings.system' },
  { value: 'es', label: 'settings.language.es' },
  { value: 'en', label: 'settings.language.en' },
];

export const themeOptions: readonly Option<Preferences['theme']>[] = [
  { value: 'system', label: 'settings.system' },
  { value: 'light', label: 'settings.theme.light' },
  { value: 'dark', label: 'settings.theme.dark' },
  { value: 'sepia', label: 'settings.theme.sepia' },
  { value: 'night', label: 'settings.theme.night' },
];

/** i18n key of a theme's name. */
export const themeLabel = (theme: Preferences['theme']): string =>
  theme === 'system' ? 'settings.system' : `settings.theme.${theme}`;

export const pageSizeOptions: readonly Option<Preferences['pageSize']>[] = [
  { value: 'a4', label: 'pages.size.a4' },
  { value: 'letter', label: 'pages.size.letter' },
];

/** 1.1 → "110%". */
export const zoomLabel = (zoom: number): string => `${Math.round(zoom * 100)}%`;
