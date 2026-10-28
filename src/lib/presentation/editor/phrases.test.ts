import { describe, expect, it } from 'vitest';
import { createTranslator } from '../i18n/translator';
import { editorPhrases } from './phrases';

describe('editorPhrases', () => {
  it('translates the search panel texts', () => {
    const phrases = editorPhrases(createTranslator('es'));
    expect(phrases['Find']).toBe('Buscar');
    expect(phrases['replace all']).toBe('reemplazar todo');
    expect(phrases['replaced $ matches']).toBe('$ coincidencias reemplazadas');
  });

  it('keeps the English texts for English', () => {
    expect(editorPhrases(createTranslator('en'))['match case']).toBe('match case');
  });

  it('has a translation for every phrase', () => {
    for (const locale of ['en', 'es'] as const) {
      const phrases = editorPhrases(createTranslator(locale));
      for (const [phrase, text] of Object.entries(phrases)) {
        expect(text, `${locale}: ${phrase}`).not.toMatch(/^editor\./);
      }
    }
  });
});
