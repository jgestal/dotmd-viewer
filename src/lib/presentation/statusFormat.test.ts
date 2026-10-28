import { describe, expect, it } from 'vitest';
import { createTranslator } from './i18n/translator';
import { createStatusFormat, lineEndingName } from './statusFormat';

const en = createStatusFormat('en-US', createTranslator('en'));
const es = createStatusFormat('es-ES', createTranslator('es'));

describe('counts use the singular text for exactly one', () => {
  it.each([
    [en.words(1), '1 word'],
    [en.words(0), '0 words'],
    [en.words(2), '2 words'],
    [en.characters(1), '1 character'],
    [en.characters(2), '2 characters'],
    [en.charactersNoSpaces(1), '1 character (no spaces)'],
    [en.charactersNoSpaces(3), '3 characters (no spaces)'],
    [en.lines(1), '1 line'],
    [en.lines(12), '12 lines'],
  ])('English: %s', (text, expected) => {
    expect(text).toBe(expected);
  });

  it.each([
    [es.words(1), '1 palabra'],
    [es.words(0), '0 palabras'],
    [es.characters(1), '1 carácter'],
    [es.charactersNoSpaces(1), '1 carácter (sin espacios)'],
    [es.charactersNoSpaces(4), '4 caracteres (sin espacios)'],
    [es.lines(1), '1 línea'],
    [es.lines(2), '2 líneas'],
  ])('Spanish: %s', (text, expected) => {
    expect(text).toBe(expected);
  });
});

describe('numbers follow the locale grouping', () => {
  it('groups thousands with a comma in English and a dot in Spanish from 10 000 on', () => {
    expect(en.words(1234)).toBe('1,234 words');
    expect(en.characters(1_000_000)).toBe('1,000,000 characters');
    expect(es.words(12345)).toBe('12.345 palabras');
  });

  it('keeps four-digit Spanish numbers ungrouped, as the locale does', () => {
    expect(es.words(1234)).toBe('1234 palabras');
  });
});

describe('reading time, cursor and mode', () => {
  it('reads minutes in each language', () => {
    expect(en.readingTime(7)).toBe('7 min read');
    expect(es.readingTime(7)).toBe('7 min de lectura');
  });

  it('shows the 1-based line and column', () => {
    expect(en.cursor({ line: 3, column: 14 })).toBe('Ln 3, Col 14');
    expect(es.cursor({ line: 3, column: 14 })).toBe('Ln 3, Col 14');
  });

  it('says reading when not editing, and names the edit mode while editing', () => {
    expect(en.mode(false, 'code')).toBe('Reading');
    expect(en.mode(true, 'code')).toBe('Editing: Code');
    expect(en.mode(true, 'split')).toBe('Editing: Split');
    expect(es.mode(false, 'code')).toBe('Lectura');
    expect(es.mode(true, 'preview')).toBe('Editando: Vista previa');
  });
});

describe('encoding and line ending labels', () => {
  it.each([
    ['utf-8', 'UTF-8'],
    ['utf-16le', 'UTF-16 LE'],
    ['utf-16be', 'UTF-16 BE'],
    ['windows-1252', 'Windows-1252'],
  ] as const)('names %s', (encoding, label) => {
    expect(en.encoding(encoding, false)).toBe(label);
  });

  it('adds the BOM marker only when the file has one', () => {
    expect(en.encoding('utf-8', true)).toBe('UTF-8 with BOM');
    expect(es.encoding('utf-16le', true)).toBe('UTF-16 LE con BOM');
  });

  it('shows CRLF and LF', () => {
    expect(lineEndingName('crlf')).toBe('CRLF');
    expect(lineEndingName('lf')).toBe('LF');
    expect(en.lineEnding('crlf')).toBe('CRLF');
  });
});
