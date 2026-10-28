// Outline (table of contents) of a Markdown document: its headings with level, plain text,
// unique anchor slug and source line.

import { codeLineMask, splitFrontMatter, splitLines } from './markdownLines';

export interface Heading {
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  /** Heading text without inline Markdown. */
  readonly text: string;
  /** Unique anchor id, GitHub style (`-1`, `-2`… on duplicates). */
  readonly slug: string;
  /** Zero-based line in the original document, front matter included. */
  readonly line: number;
}

type Level = Heading['level'];

interface RawHeading {
  readonly level: Level;
  readonly text: string;
  readonly line: number;
}

const ATX_HEADING = /^ {0,3}(#{1,6})(?=[ \t]|$)(.*)$/;
const ATX_CLOSING = /(?:^|[ \t]+)#+[ \t]*$/;
const SETEXT_UNDERLINE = /^ {0,3}(=+|-+)[ \t]*$/;
const NON_PARAGRAPH_START =
  /^(?: {4,}|\t| {0,3}(?:>|[-+*][ \t]|\d{1,9}[.)][ \t]|(?:[-*_][ \t]*){3,}$|#{1,6}(?:[ \t]|$)))/;
const INLINE_CODE = /(`+)([\s\S]*?[^`])\1(?!`)/g;
const SLUG_FORBIDDEN = /[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu;
const FALLBACK_SLUG = 'section';

/** GitHub-style anchor for a heading text (without duplicate numbering). */
export const slugify = (text: string): string => {
  const slug = text.toLowerCase().replace(SLUG_FORBIDDEN, '').replaceAll(' ', '-');
  return slug === '' ? FALLBACK_SLUG : slug;
};

const stripEmphasis = (text: string): string =>
  text
    .replace(/(?<!\\)(\*\*|__)(?=\S)([\s\S]*?[^\s\\])\1/g, '$2')
    .replace(/(?<!\\)~~(?=\S)([\s\S]*?[^\s\\])~~/g, '$1')
    .replace(/(?<!\\)\*(?=\S)([\s\S]*?[^\s\\])\*/g, '$1')
    .replace(/(^|[^\w\\])_(?=\S)([\s\S]*?[^\s\\])_(?!\w)/g, '$1$2');

const stripMarkup = (text: string): string =>
  stripEmphasis(
    text
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\](?:\([^)]*\)|\[[^\]]*\])/g, '$1')
      .replace(/<\/?[A-Za-z][^>]*>/g, ''),
  ).replace(/\\([!-/:-@[-`{-~])/g, '$1');

/** Plain text of an inline Markdown fragment (code spans keep their content verbatim). */
const plainText = (markdown: string): string => {
  let result = '';
  let last = 0;
  for (const code of markdown.matchAll(INLINE_CODE)) {
    result += stripMarkup(markdown.slice(last, code.index)) + code[2]!.trim();
    last = code.index + code[0].length;
  }
  return (result + stripMarkup(markdown.slice(last))).trim();
};

const atxHeading = (line: string, index: number): RawHeading | null => {
  const match = ATX_HEADING.exec(line);
  if (!match) return null;
  const content = match[2]!.trim().replace(ATX_CLOSING, '');
  return { level: match[1]!.length as Level, text: plainText(content), line: index };
};

const isParagraphLine = (line: string): boolean =>
  line.trim() !== '' && !NON_PARAGRAPH_START.test(line);

const withUniqueSlugs = (raw: readonly RawHeading[]): Heading[] => {
  const used = new Set<string>();
  const counters = new Map<string, number>();
  return raw.map((heading) => {
    const base = slugify(heading.text);
    let slug = base;
    while (used.has(slug)) {
      const next = (counters.get(base) ?? 0) + 1;
      counters.set(base, next);
      slug = `${base}-${next}`;
    }
    used.add(slug);
    return { ...heading, slug };
  });
};

/** Headings of a document (ATX and Setext), ignoring front matter and fenced code. */
export const extractOutline = (markdown: string): Heading[] => {
  const { body, bodyStartLine } = splitFrontMatter(markdown);
  const lines = splitLines(body);
  const inCode = codeLineMask(lines);
  const raw: RawHeading[] = [];
  let paragraphStart = -1;

  lines.forEach((line, index) => {
    if (inCode[index]) {
      paragraphStart = -1;
      return;
    }
    const underline = SETEXT_UNDERLINE.exec(line);
    if (underline && paragraphStart !== -1) {
      const paragraph = lines.slice(paragraphStart, index).map((l) => l.trim());
      raw.push({
        level: underline[1]![0] === '=' ? 1 : 2,
        text: plainText(paragraph.join(' ')),
        line: bodyStartLine + paragraphStart,
      });
      paragraphStart = -1;
      return;
    }
    const atx = atxHeading(line, bodyStartLine + index);
    if (atx) raw.push(atx);
    if (!isParagraphLine(line)) paragraphStart = -1;
    else if (paragraphStart === -1) paragraphStart = index;
  });
  return withUniqueSlugs(raw);
};

/** Index of the last heading at or above `topLine`, or -1 when none has started yet. */
export const activeHeadingIndex = (outline: readonly Heading[], topLine: number): number =>
  outline.findLastIndex((heading) => heading.line <= topLine);
