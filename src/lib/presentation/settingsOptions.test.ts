import { describe, expect, it } from 'vitest';
import { defaultPreferences } from '$lib/domain/preferences';
import { en } from './i18n/en';
import { languageOptions, pageSizeOptions, themeOptions, zoomLabel } from './settingsOptions';

describe('settings options', () => {
  it('offers system, Spanish and English languages in that order', () => {
    expect(languageOptions.map((option) => option.value)).toEqual(['system', 'es', 'en']);
  });

  it('offers system, light and dark themes in that order', () => {
    expect(themeOptions.map((option) => option.value)).toEqual(['system', 'light', 'dark']);
  });

  it('offers A4 and Letter pages', () => {
    expect(pageSizeOptions.map((option) => option.value)).toEqual(['a4', 'letter']);
  });

  it('includes the stored defaults among the options', () => {
    expect(languageOptions.map((o) => o.value)).toContain(defaultPreferences.language);
    expect(themeOptions.map((o) => o.value)).toContain(defaultPreferences.theme);
    expect(pageSizeOptions.map((o) => o.value)).toContain(defaultPreferences.pageSize);
  });

  it('labels every option with a translated key', () => {
    const keys = [...languageOptions, ...themeOptions, ...pageSizeOptions].map((o) => o.label);
    for (const key of keys) expect(Object.keys(en)).toContain(key);
  });

  it.each([
    [1, '100%'],
    [0.5, '50%'],
    [1.1, '110%'],
    [3, '300%'],
  ])('shows zoom %s as %s', (zoom, text) => {
    expect(zoomLabel(zoom)).toBe(text);
  });
});
