// The user guide shown on first launch and from Help ▸ User Guide, one Markdown text per language.
import type { Locale } from '../i18n/translator';
import en from './en.md?raw';
import es from './es.md?raw';

const guides: Readonly<Record<Locale, string>> = { en, es };

export const userGuide = (locale: Locale): string => guides[locale];
