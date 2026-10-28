// Presentation slides from ordinary Markdown. A slide separator is a line made of exactly `---`
// (up to 3 leading and any trailing spaces) that sits outside fenced code and follows a blank
// line or the start of the body, so a Setext `---` underlining a paragraph is not a separator.
// Only `---` splits: `***` and `___` stay thematic breaks inside a slide, which keeps it predictable.

import { codeLineMask, splitFrontMatter, splitLines } from './markdownLines';

export interface Slide {
  readonly markdown: string;
  /** Zero-based line in the original document where the slide starts. */
  readonly startLine: number;
  /** Zero-based line in the original document where the slide ends (inclusive). */
  readonly endLine: number;
}

interface LineRange {
  readonly start: number;
  readonly end: number;
}

const SEPARATOR = /^ {0,3}---[ \t]*$/;

const isBlank = (line: string): boolean => line.trim() === '';

const separatorLines = (lines: readonly string[]): number[] => {
  const inCode = codeLineMask(lines);
  const separators: number[] = [];
  lines.forEach((line, index) => {
    const startsBlock = index === 0 || isBlank(lines[index - 1]!);
    if (!inCode[index] && startsBlock && SEPARATOR.test(line)) separators.push(index);
  });
  return separators;
};

/** Inclusive line ranges between separators, with blank lines trimmed; empty ones are dropped. */
const slideRanges = (lines: readonly string[]): LineRange[] => {
  const bounds = [-1, ...separatorLines(lines), lines.length];
  const ranges: LineRange[] = [];
  for (let i = 1; i < bounds.length; i++) {
    let start = bounds[i - 1]! + 1;
    let end = bounds[i]! - 1;
    while (start <= end && isBlank(lines[start]!)) start++;
    while (end >= start && isBlank(lines[end]!)) end--;
    if (start <= end) ranges.push({ start, end });
  }
  return ranges;
};

/** Splits a document into slides at top-level `---`; the front matter is not a slide. */
export const splitSlides = (markdown: string): Slide[] => {
  const { body, bodyStartLine } = splitFrontMatter(markdown);
  const lines = splitLines(body);
  return slideRanges(lines).map(({ start, end }) => ({
    markdown: lines.slice(start, end + 1).join('\n'),
    startLine: bodyStartLine + start,
    endLine: bodyStartLine + end,
  }));
};

/**
 * Index of the slide containing a source line: the nearest previous slide when the line is a
 * separator or blank, the first one before the first slide, the last one past the end, and -1
 * when there are no slides.
 */
export const slideAtLine = (slides: readonly Slide[], line: number): number => {
  if (slides.length === 0) return -1;
  const next = slides.findIndex((slide) => slide.startLine > line);
  if (next === -1) return slides.length - 1;
  return Math.max(next - 1, 0);
};
