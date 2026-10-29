// The single document open in the viewer: its text, where it lives on disk and how to write it
// back exactly as it was read (line ending, encoding, BOM). Content is always held with `\n`.

import { retargetPath } from './paths';

export type LineEnding = 'lf' | 'crlf';

/** Names match the ones the Rust side reports when it decodes a file. */
export type Encoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252';

export interface Document {
  /** Absolute path on disk, or `null` while the document has never been saved. */
  readonly path: string | null;
  /** Current text, with every line break normalised to `\n`. */
  readonly content: string;
  /** Text as last read from or written to disk, normalised like `content`. */
  readonly savedContent: string;
  readonly lineEnding: LineEnding;
  readonly encoding: Encoding;
  readonly hasBom: boolean;
  /** What an unsaved document is called instead of "untitled" (the built-in guide). */
  readonly name?: string;
}

export interface OpenDocumentInput {
  readonly path: string | null;
  readonly raw: string;
  readonly encoding: Encoding;
  readonly hasBom: boolean;
}

export interface ReloadResult {
  readonly doc: Document;
  /** True when the file changed on disk while the document has unsaved edits. */
  readonly conflict: boolean;
}

const CRLF = /\r\n/g;
const BARE_LF = /(?<!\r)\n/g;
const LINE_BREAK = /\r\n|\r/g;
const PATH_SEPARATOR = /[\\/]/;

const countMatches = (text: string, pattern: RegExp): number => text.match(pattern)?.length ?? 0;

/** Treats a lone CR (classic Mac) as a line break, like `splitLines` does. */
const normaliseLineBreaks = (raw: string): string => raw.replace(LINE_BREAK, '\n');

/** The most frequent line ending wins; a tie, or no line break at all, means LF. */
export const detectLineEnding = (raw: string): LineEnding =>
  countMatches(raw, CRLF) > countMatches(raw, BARE_LF) ? 'crlf' : 'lf';

export const openDocument = ({ path, raw, encoding, hasBom }: OpenDocumentInput): Document => {
  const content = normaliseLineBreaks(raw);
  return {
    path,
    content,
    savedContent: content,
    lineEnding: detectLineEnding(raw),
    encoding,
    hasBom,
  };
};

/** An unsaved document; `content` starts as saved, so a read-only text like the guide is clean. */
export const newDocument = (content = '', name?: string): Document => ({
  ...openDocument({ path: null, raw: content, encoding: 'utf-8', hasBom: false }),
  ...(name === undefined ? {} : { name }),
});

export const editDocument = (doc: Document, content: string): Document => ({
  ...doc,
  content: normaliseLineBreaks(content),
});

export const isDirty = (doc: Document): boolean => doc.content !== doc.savedContent;

/** The text to write to disk: `content` with the document's own line ending restored. */
export const serialise = (doc: Document): string =>
  doc.lineEnding === 'crlf' ? doc.content.replaceAll('\n', '\r\n') : doc.content;

/** Records a successful Save (no `path`) or Save As (the new `path`). */
export const markSaved = (doc: Document, path?: string): Document => ({
  ...doc,
  path: path ?? doc.path,
  savedContent: doc.content,
});

/** The file behind the document is gone: the text counts as unsaved so Save writes it out again. */
export const markUnsaved = (doc: Document): Document => ({
  ...doc,
  savedContent: doc.content === '' ? '\n' : '',
});

/**
 * Applies a fresh read of the file. A clean document simply takes the new text; unsaved edits
 * are never overwritten, and are reported as a conflict only if the file really changed.
 */
export const reloadFromDisk = (doc: Document, raw: string): ReloadResult => {
  const content = normaliseLineBreaks(raw);
  if (isDirty(doc)) return { doc, conflict: content !== doc.savedContent };
  return {
    doc: { ...doc, content, savedContent: content, lineEnding: detectLineEnding(raw) },
    conflict: false,
  };
};

/** The file name of the document, or `untitled` when it has no path. */
export const displayName = (doc: Document, untitled: string): string =>
  doc.path === null ? (doc.name ?? untitled) : (doc.path.split(PATH_SEPARATOR).pop() ?? doc.path);

/** Follows a rename or move of `from` to `to`: a document at or inside it now lives at the new path. */
export const retargetDocument = (
  doc: Document,
  from: string,
  to: string,
  caseInsensitive = false,
): Document =>
  doc.path === null ? doc : { ...doc, path: retargetPath(doc.path, from, to, caseInsensitive) };
