// The editor's look, built from the app's CSS tokens so it follows light and dark by itself.
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

const FONT_SIZE = 'calc(14px * var(--editor-zoom, 1))';
const SEARCH_PANEL = '.cm-panel.cm-search';

const theme = EditorView.theme({
  '&': { height: '100%', background: 'var(--bg)', color: 'var(--fg)', fontSize: FONT_SIZE },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-code)', lineHeight: '1.6', overflow: 'auto' },
  '.cm-content': { padding: '16px 0 40vh', caretColor: 'var(--accent)' },
  '.cm-line': { padding: '0 24px' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-activeLine': { background: 'var(--bg-hover)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    background: 'var(--sel)',
  },
  '&.cm-focused .cm-matchingBracket': {
    background: 'var(--accent-soft)',
    outline: '1px solid var(--accent)',
  },
  '.cm-placeholder': { color: 'var(--fg-muted)' },
  '.cm-searchMatch': { background: 'var(--doc-mark, var(--accent-soft))' },
  '.cm-searchMatch-selected': { background: 'var(--sel)', outline: '1px solid var(--accent)' },
  '.cm-panels': { background: 'var(--bg-elev)', color: 'var(--fg)', fontFamily: 'var(--font-ui)' },
  '.cm-panels-top': { borderBottom: '1px solid var(--border)' },
  [SEARCH_PANEL]: { padding: '8px 32px 8px 12px', fontSize: '12px' },
  [`${SEARCH_PANEL} input, ${SEARCH_PANEL} button`]: { font: 'inherit', color: 'var(--fg)' },
  [`${SEARCH_PANEL} input.cm-textfield`]: {
    backgroundColor: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '3px 8px',
  },
  [`${SEARCH_PANEL} input.cm-textfield:focus-visible`]: {
    outline: '2px solid var(--accent)',
    outlineOffset: '1px',
  },
  [`${SEARCH_PANEL} button`]: {
    background: 'var(--bg-hover)',
    backgroundImage: 'none',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '3px 10px',
    cursor: 'pointer',
  },
  [`${SEARCH_PANEL} button:hover`]: { background: 'var(--bg-active)' },
  [`${SEARCH_PANEL} button:focus-visible`]: { outline: '2px solid var(--accent)' },
  [`${SEARCH_PANEL} label`]: { color: 'var(--fg-muted)' },
  [`${SEARCH_PANEL} [name="close"]`]: {
    color: 'var(--fg-muted)',
    background: 'transparent',
    border: 'none',
    fontSize: '16px',
  },
});

const highlighting = HighlightStyle.define([
  { tag: tags.heading, fontWeight: '700', color: 'var(--hl-title)' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--accent)' },
  { tag: tags.monospace, color: 'var(--hl-meta)' },
  { tag: tags.quote, color: 'var(--fg-muted)', fontStyle: 'italic' },
  {
    tag: [tags.processingInstruction, tags.meta, tags.contentSeparator, tags.labelName],
    color: 'var(--fg-muted)',
  },
  { tag: tags.keyword, color: 'var(--hl-keyword)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--hl-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--hl-number)' },
  { tag: tags.comment, color: 'var(--hl-comment)', fontStyle: 'italic' },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: 'var(--hl-title)',
  },
  {
    tag: [tags.typeName, tags.className, tags.propertyName, tags.attributeName],
    color: 'var(--hl-type)',
  },
]);

/** Syntax colours alone, for code blocks embedded in another editor (the visual one). */
export const codeHighlighting: Extension = syntaxHighlighting(highlighting);

export const editorTheme: Extension = [theme, codeHighlighting];
