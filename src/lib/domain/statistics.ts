// Document statistics shown in the status bar.
//
// Rules:
// - `lines` follows editor semantics: it is the number of lines of the raw text, so "a\n" has 2
//   lines (the last one empty) and the empty document has 1, exactly like CodeMirror reports.
//   Front matter and code are included because the editor shows them.
// - Words and characters are computed on the *visible text*: the front matter and fenced code
//   blocks (not prose) are dropped and the Markdown syntax is stripped, keeping link texts, image
//   alt texts and inline code contents.
// - A bare URL or autolink counts as a single word.
// - Words are the `isWordLike` segments of `Intl.Segmenter`, so accents, CJK and hyphenated words
//   follow the Unicode word-break rules.
// - Characters are grapheme clusters (an emoji with a skin tone counts once); line breaks of the
//   visible text count as characters but not as `charactersNoSpaces`.
// - Reading time is `ceil(words / wordsPerMinute)`; no words means 0 minutes.

import { codeLineMask, splitFrontMatter, splitLines } from './markdownLines';

export interface DocumentStatistics {
  readonly words: number;
  readonly characters: number;
  readonly charactersNoSpaces: number;
  readonly lines: number;
  readonly readingMinutes: number;
}

export const DEFAULT_WORDS_PER_MINUTE = 230;

const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
// Stryker disable next-line ObjectLiteral: 'grapheme' is Intl.Segmenter's default granularity; kept explicit for readers.
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

const SYNTAX_ONLY_LINE = /^[\s|:*_=~-]*$/;
const BLOCKQUOTE_PREFIX = /^\s*(?:>\s?)+/;
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;
const TASK_BOX = /^\s*\[[ xX]\]\s+/;
const HEADING_MARKER = /^\s{0,3}#{1,6}\s+/;
const IMAGE_OR_LINK = /!?\[([^\]]*)\]\([^)]*\)/g;
const REFERENCE_LINK = /!?\[([^\]]*)\]\[[^\]]*\]/g;
const FOOTNOTE_REF = /\[\^[^\]]+\]/g;
const AUTOLINK = /<((?:https?|mailto):[^>\s]+)>/g;
const HTML_TAG = /<\/?[A-Za-z][^>]*>/g;
const BARE_URL = /\bhttps?:\/\/\S+/g;
const EMPHASIS_MARKER = /[*~]+|={2,}|(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu;
// Stryker disable next-line Regex: with the global flag, removing one backtick at a time removes the same runs.
const INLINE_CODE_TICKS = /`+/g;
const TABLE_PIPE = /\|/g;
const WHITESPACE = /\s/gu;

const stripLineSyntax = (line: string): string =>
  line
    .replace(BLOCKQUOTE_PREFIX, '')
    .replace(LIST_MARKER, '')
    .replace(TASK_BOX, '')
    .replace(HEADING_MARKER, '')
    .replace(IMAGE_OR_LINK, '$1')
    .replace(REFERENCE_LINK, '$1')
    .replace(FOOTNOTE_REF, '')
    .replace(AUTOLINK, '$1')
    .replace(HTML_TAG, '')
    .replace(EMPHASIS_MARKER, '')
    .replace(INLINE_CODE_TICKS, '')
    .replace(TABLE_PIPE, ' ');

/** The prose of a document: no front matter, no fenced code, no Markdown syntax. */
const visibleText = (markdown: string): string => {
  const lines = splitLines(splitFrontMatter(markdown).body);
  const code = codeLineMask(lines);
  return lines
    .filter((line, index) => !code[index] && !SYNTAX_ONLY_LINE.test(line))
    .map(stripLineSyntax)
    .join('\n');
};

const countWords = (text: string): number => {
  const withUrlsAsWords = text.replace(BARE_URL, 'url');
  return [...wordSegmenter.segment(withUrlsAsWords)].filter((segment) => segment.isWordLike).length;
};

const countGraphemes = (text: string): number => [...graphemeSegmenter.segment(text)].length;

export const computeStatistics = (
  markdown: string,
  wordsPerMinute: number = DEFAULT_WORDS_PER_MINUTE,
): DocumentStatistics => {
  const text = visibleText(markdown);
  const words = countWords(text);
  return {
    words,
    characters: countGraphemes(text),
    charactersNoSpaces: countGraphemes(text.replace(WHITESPACE, '')),
    lines: splitLines(markdown).length,
    readingMinutes: Math.ceil(words / wordsPerMinute),
  };
};
