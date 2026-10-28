import type { Translate } from '$lib/ports';
import type { Preferences } from '$lib/domain/preferences';
import { en } from './en';
import { es } from './es';

export type Locale = 'en' | 'es';

const dictionaries: Readonly<Record<Locale, Readonly<Record<string, string>>>> = { en, es };
const placeholder = /\{(\w+)\}/g;
const spanishTag = /^es(-|_|$)/i;
const warnedKeys = new Set<string>();

export function resolveLocale(
  preference: Preferences['language'],
  systemLanguages: readonly string[],
): Locale {
  if (preference !== 'system') return preference;
  return systemLanguages.some((language) => spanishTag.test(language)) ? 'es' : 'en';
}

function warnMissing(key: string): void {
  if (!import.meta.env.DEV || warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(`[i18n] Missing translation key: ${key}`);
}

export function createTranslator(locale: Locale): Translate {
  const dictionary = dictionaries[locale];
  return (key, vars = {}) => {
    const template = dictionary[key];
    if (template === undefined) {
      warnMissing(key);
      return key;
    }
    return template.replace(placeholder, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    );
  };
}
