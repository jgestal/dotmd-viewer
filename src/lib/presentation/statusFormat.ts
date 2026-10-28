// The texts of the status bar. Pure: it takes the locale and the translator, so the component only
// lays the strings out. Numbers follow the locale's grouping, and a count of exactly one uses the
// singular text.
import type { Encoding, LineEnding } from '$lib/domain/document';
import type { Preferences } from '$lib/domain/preferences';
import type { Translate } from '$lib/ports';

type EditMode = Preferences['editMode'];

interface CountForms {
  readonly one: string;
  readonly other: string;
}

const WORDS: CountForms = { one: 'status.word', other: 'status.words' };
const CHARACTERS: CountForms = { one: 'status.character', other: 'status.characters' };
const CHARACTERS_NO_SPACES: CountForms = {
  one: 'status.characterNoSpaces',
  other: 'status.charactersNoSpaces',
};
const LINES: CountForms = { one: 'status.line', other: 'status.lines' };

/** Encoding names are proper names, so they are not translated. */
export const ENCODING_NAMES: Readonly<Record<Encoding, string>> = {
  'utf-8': 'UTF-8',
  'utf-16le': 'UTF-16 LE',
  'utf-16be': 'UTF-16 BE',
  'windows-1252': 'Windows-1252',
};

export const lineEndingName = (lineEnding: LineEnding): string =>
  lineEnding === 'crlf' ? 'CRLF' : 'LF';

export interface StatusFormat {
  words(count: number): string;
  characters(count: number): string;
  charactersNoSpaces(count: number): string;
  lines(count: number): string;
  readingTime(minutes: number): string;
  cursor(position: { readonly line: number; readonly column: number }): string;
  mode(editing: boolean, editMode: EditMode): string;
  encoding(encoding: Encoding, hasBom: boolean): string;
  lineEnding(lineEnding: LineEnding): string;
}

export const createStatusFormat = (locale: string, t: Translate): StatusFormat => {
  const numbers = new Intl.NumberFormat(locale);
  const count = (value: number, forms: CountForms): string =>
    t(value === 1 ? forms.one : forms.other, { count: numbers.format(value) });

  return {
    words: (value) => count(value, WORDS),
    characters: (value) => count(value, CHARACTERS),
    charactersNoSpaces: (value) => count(value, CHARACTERS_NO_SPACES),
    lines: (value) => count(value, LINES),
    readingTime: (minutes) => t('status.readingTime', { minutes: numbers.format(minutes) }),
    cursor: ({ line, column }) =>
      t('status.cursor', { line: numbers.format(line), column: numbers.format(column) }),
    mode: (editing, editMode) =>
      editing ? t('status.editing', { mode: t(`mode.${editMode}`) }) : t('status.reading'),
    encoding: (encoding, hasBom) =>
      hasBom
        ? t('status.encodingWithBom', { encoding: ENCODING_NAMES[encoding] })
        : ENCODING_NAMES[encoding],
    lineEnding: lineEndingName,
  };
};
