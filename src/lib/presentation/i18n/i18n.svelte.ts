import type { Preferences } from '$lib/domain/preferences';
import { createTranslator, resolveLocale, type Locale } from './translator';

const systemLanguages = (): readonly string[] =>
  typeof navigator === 'undefined' ? [] : navigator.languages;

let locale = $state<Locale>(resolveLocale('system', systemLanguages()));
const translate = $derived(createTranslator(locale));

/** Reactive translations: call `i18n.t` inside components and they follow language changes. */
export const i18n = {
  get locale(): Locale {
    return locale;
  },
  get t() {
    return translate;
  },
  setPreference(preference: Preferences['language']): void {
    locale = resolveLocale(preference, systemLanguages());
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  },
};
