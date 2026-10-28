import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTranslator, resolveLocale } from './translator';
import { en } from './en';
import { es } from './es';

describe('resolveLocale', () => {
  it('honours an explicit preference over the system languages', () => {
    expect(resolveLocale('en', ['es-ES'])).toBe('en');
    expect(resolveLocale('es', ['en-US'])).toBe('es');
  });

  it('follows the first Spanish system language for the system preference', () => {
    expect(resolveLocale('system', ['es-ES', 'en'])).toBe('es');
    expect(resolveLocale('system', ['fr-FR', 'es-MX'])).toBe('es');
    expect(resolveLocale('system', ['es'])).toBe('es');
    expect(resolveLocale('system', ['ES-ar'])).toBe('es');
    expect(resolveLocale('system', ['es_ES'])).toBe('es');
  });

  it('falls back to English for other or missing languages', () => {
    expect(resolveLocale('system', ['en-US'])).toBe('en');
    expect(resolveLocale('system', ['ca-ES', 'gl'])).toBe('en');
    expect(resolveLocale('system', ['esperanto'])).toBe('en');
    expect(resolveLocale('system', [])).toBe('en');
  });
});

describe('createTranslator', () => {
  afterEach(() => vi.restoreAllMocks());

  it('translates a key in each locale', () => {
    expect(createTranslator('en')('mode.preview')).toBe('Preview');
    expect(createTranslator('es')('mode.preview')).toBe('Vista previa');
  });

  it('interpolates every occurrence of a variable, numbers included', () => {
    const t = createTranslator('en');
    expect(t('status.words', { count: 1200 })).toBe('1200 words');
    expect(t('workspace.operationFailed', { name: 'a.md', message: 'boom' })).toBe(
      'Operation failed on "a.md": boom',
    );
  });

  it('keeps a placeholder untouched when its variable is not provided', () => {
    expect(createTranslator('es')('status.lines')).toBe('{count} líneas');
  });

  it('returns the key for an unknown key and warns once per key in dev', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = createTranslator('en');
    expect(t('nope.missing')).toBe('nope.missing');
    expect(t('nope.missing')).toBe('nope.missing');
    expect(t('nope.other')).toBe('nope.other');
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith('[i18n] Missing translation key: nope.missing');
  });
});

describe('dictionaries', () => {
  it('have exactly the same keys', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it('use the same placeholders in both languages', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(es[key]), key).toEqual(placeholders(en[key]));
    }
  });
});
