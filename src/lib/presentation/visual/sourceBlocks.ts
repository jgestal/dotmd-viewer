// The visual editor rewrites Markdown in its own style (list markers, table padding, escapes), so
// it never hands the app its whole serialisation. The source is cut into top-level blocks, one
// per editor block; after an edit only the blocks that changed are re-serialised and spliced in,
// and every other byte of the original text stays as it was.
import { splitFrontMatter } from '$lib/domain/markdownLines';

/** Offsets of a top-level block in the body text: `from` inclusive, `to` exclusive. */
export interface BlockRange {
  readonly from: number;
  readonly to: number;
}

/** A Markdown body with the range of each of its top-level blocks. */
export interface IndexedBody {
  readonly body: string;
  readonly ranges: readonly BlockRange[];
}

/** The editor's change, in blocks: how many it kept at each end and what replaces the rest. */
export interface BlockEdit {
  readonly head: number;
  readonly tail: number;
  /** The new blocks as Markdown (no surrounding blank lines). */
  readonly middle: string;
  /** Ranges of the new blocks inside `middle`. */
  readonly middleRanges: readonly BlockRange[];
}

export interface PrefixSplit {
  /** The front matter exactly as written, closing fence and its line break included. */
  readonly prefix: string;
  /** Everything after it: what the visual editor shows. */
  readonly body: string;
  /** Zero-based line of the body's first line in the whole document. */
  readonly bodyStartLine: number;
}

const LINE_BREAK = /\r\n|\r|\n/g;
const LEADING_SPACE = /^\s*/;
const TRAILING_SPACE = /\s*$/;

/** Separates the front matter (kept as an opaque prefix) from the body the editor shows. */
export function splitPrefix(text: string): PrefixSplit {
  const { bodyStartLine } = splitFrontMatter(text);
  let offset = 0;
  const breaks = text.matchAll(LINE_BREAK);
  for (let line = 0; line < bodyStartLine; line++) {
    const next = breaks.next();
    if (next.done) return { prefix: text, body: '', bodyStartLine };
    offset = next.value.index + next.value[0].length;
  }
  return { prefix: text.slice(0, offset), body: text.slice(offset), bodyStartLine };
}

/** The line ending the text already uses (`\n` when it has none). */
export const lineEndingOf = (text: string): string => /\r\n|\r|\n/.exec(text)?.[0] ?? '\n';

/** Rewrites the `\n` line breaks of the editor's output with `ending`. */
export const withLineEnding = (text: string, ending: string): string =>
  ending === '\n' ? text : text.replace(/\n/g, ending);

/**
 * Completes the parser's block ranges: a block it built itself (no position) spans the text
 * between its neighbours, trimmed of surrounding white space.
 */
export function blockRanges(body: string, spans: readonly (BlockRange | null)[]): BlockRange[] {
  const ranges: BlockRange[] = [];
  spans.forEach((span, index) => {
    if (span) {
      ranges.push(span);
      return;
    }
    const start = ranges.at(-1)?.to ?? 0;
    const end = spans.slice(index + 1).find((next) => next !== null)?.from ?? body.length;
    const gap = body.slice(start, end);
    const from = start + LEADING_SPACE.exec(gap)![0].length;
    ranges.push({ from, to: Math.max(from, end - TRAILING_SPACE.exec(gap)![0].length) });
  });
  return ranges;
}

/** How many items two lists share at the start and, without overlapping, at the end. */
export function commonEnds<T>(
  before: readonly T[],
  after: readonly T[],
  same: (a: T, b: T) => boolean,
): { head: number; tail: number } {
  const shortest = Math.min(before.length, after.length);
  let head = 0;
  while (head < shortest && same(before[head], after[head])) head++;
  let tail = 0;
  while (
    tail < shortest - head &&
    same(before[before.length - 1 - tail], after[after.length - 1 - tail])
  ) {
    tail++;
  }
  return { head, tail };
}

interface Splice {
  readonly from: number;
  readonly to: number;
  readonly insert: string;
  /** Where the new blocks start once inserted. */
  readonly middleAt: number;
}

function spliceFor({ body, ranges }: IndexedBody, { head, tail, middle }: BlockEdit): Splice {
  const count = ranges.length;
  const firstKeptAfter = count - tail;
  const blankLine = lineEndingOf(body).repeat(2);
  if (firstKeptAfter > head) {
    let from = ranges[head].from;
    let to = ranges[firstKeptAfter - 1].to;
    // A deletion also takes one separator, so the neighbours stay one blank line apart.
    if (middle === '' && tail > 0) to = ranges[firstKeptAfter].from;
    else if (middle === '' && head > 0) from = ranges[head - 1].to;
    return { from, to, insert: middle, middleAt: from };
  }
  if (head > 0) {
    const at = ranges[head - 1].to;
    return { from: at, to: at, insert: blankLine + middle, middleAt: at + blankLine.length };
  }
  if (count > 0) {
    const at = ranges[0].from;
    return { from: at, to: at, insert: middle + blankLine, middleAt: at };
  }
  return { from: 0, to: body.length, insert: middle + lineEndingOf(body), middleAt: 0 };
}

/** Applies the editor's block change to the original text, keeping the untouched blocks verbatim. */
export function applyBlockEdit(indexed: IndexedBody, edit: BlockEdit): IndexedBody {
  const { body, ranges } = indexed;
  if (edit.head + edit.tail === ranges.length && edit.middle === '') return indexed;
  const { from, to, insert, middleAt } = spliceFor(indexed, edit);
  const shift = insert.length - (to - from);
  const move = (by: number) => (range: BlockRange) => ({
    from: range.from + by,
    to: range.to + by,
  });
  return {
    body: body.slice(0, from) + insert + body.slice(to),
    ranges: [
      ...ranges.slice(0, edit.head),
      ...edit.middleRanges.map(move(middleAt)),
      ...ranges.slice(ranges.length - edit.tail).map(move(shift)),
    ],
  };
}

const ESCAPED_ALERT = /^((?:[ \t]*>[ \t]?)+)\\\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/gim;

/** Undoes the escapes Milkdown adds to syntax it does not model (GitHub alert markers). */
export const restoreSyntax = (markdown: string): string =>
  markdown.replace(ESCAPED_ALERT, '$1[!$2]');

/** One-based line of `offset` within `text`. */
export const lineAt = (text: string, offset: number): number =>
  text.slice(0, offset).split(LINE_BREAK).length;
