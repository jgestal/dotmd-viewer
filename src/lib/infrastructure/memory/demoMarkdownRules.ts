// markdown-it rules that make its HTML follow the conventions comrak produces (see
// src-tauri/src/render.rs), which is what the preview relies on: `$` maths as spans with
// `data-math-style`, `data-sourcepos` on blocks, `language-*` classes, GitHub alerts, task
// list checkboxes, and heading ids from the domain slugger.
import type { MarkdownIt, StateBlock, StateCore, StateInline, Token } from 'markdown-it';
import { slugify } from '../../domain/outline';

/** The renderer's environment: where the body starts inside the whole file (front matter). */
export type RenderEnv = { bodyStartLine: number };

const ALERTS: Readonly<Record<string, string>> = {
  NOTE: 'Note',
  TIP: 'Tip',
  IMPORTANT: 'Important',
  WARNING: 'Warning',
  CAUTION: 'Caution',
};
const ALERT_MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|$)/i;
const TASK_MARKER = /^\[([ xX])\][ \t]+/;
const DOLLAR = 0x24;

export const escapeHtml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

// Maths

function mathInline(state: StateInline, silent: boolean): boolean {
  const { src, pos } = state;
  if (src.charCodeAt(pos) !== DOLLAR) return false;
  const display = src.charCodeAt(pos + 1) === DOLLAR;
  const fence = display ? '$$' : '$';
  const start = pos + fence.length;
  const end = src.indexOf(fence, start);
  const content = end === -1 ? '' : src.slice(start, end);
  const closesCleanly = !/^\s|\s$/.test(content) && !/\d/.test(src[end + 1] ?? '');
  if (content === '' || !(display || closesCleanly)) return false;
  if (!silent) {
    const token = state.push('math', 'span', 0);
    token.content = content;
    token.meta = { display };
  }
  state.pos = end + fence.length;
  return true;
}

const lineText = (state: StateBlock, line: number): string =>
  state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);

function mathBlock(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  const first = lineText(state, startLine);
  if (!first.startsWith('$$') || state.sCount[startLine] - state.blkIndent >= 4) return false;
  let last = startLine;
  if (!(first.length > 4 && first.trimEnd().endsWith('$$'))) {
    while (++last < endLine && !lineText(state, last).trimEnd().endsWith('$$'));
    if (last >= endLine) return false;
  }
  if (silent) return true;
  const text = state.getLines(startLine, last + 1, state.blkIndent, false).trim();
  const token = state.push('math', 'span', 0);
  token.content = text.slice(2, -2).trim();
  token.meta = { display: true };
  token.map = [startLine, last + 1];
  state.line = last + 1;
  return true;
}

const renderMath = (token: Token, md: MarkdownIt): string => {
  const style = (token.meta as { display: boolean }).display ? 'display' : 'inline';
  const attrs = md.renderer.renderAttrs(token);
  return `<span${attrs} data-math-style="${style}">${escapeHtml(token.content)}</span>`;
};

// Alerts and task lists

const startsParagraph = (tokens: Token[], index: number): boolean =>
  tokens[index + 1]?.type === 'paragraph_open' && tokens[index + 2]?.type === 'inline';

function closingIndex(tokens: Token[], from: number): number {
  const { level } = tokens[from];
  return tokens.findIndex((token, i) => i > from && token.level === level && token.nesting === -1);
}

function turnIntoAlert(state: StateCore, index: number): void {
  const { tokens } = state;
  if (!startsParagraph(tokens, index)) return;
  const inline = tokens[index + 2];
  const match = ALERT_MARKER.exec(inline.content);
  if (!match) return;
  const kind = match[1].toUpperCase();
  tokens[index].tag = 'div';
  tokens[index].attrSet('class', `markdown-alert markdown-alert-${kind.toLowerCase()}`);
  tokens[closingIndex(tokens, index)].tag = 'div';

  inline.content = inline.content.slice(match[0].length);
  const lineBreak = inline.children?.findIndex((child) => child.type === 'softbreak') ?? -1;
  inline.children = lineBreak === -1 ? [] : (inline.children?.slice(lineBreak + 1) ?? []);

  const title = new state.Token('html_block', '', 0);
  title.content = `<p class="markdown-alert-title">${ALERTS[kind]}</p>\n`;
  const emptyParagraph = inline.content === '' ? 3 : 0;
  tokens.splice(index + 1, emptyParagraph, title);
}

function turnIntoTask(state: StateCore, index: number): void {
  const { tokens } = state;
  if (!startsParagraph(tokens, index)) return;
  const inline = tokens[index + 2];
  const match = TASK_MARKER.exec(inline.content);
  if (!match) return;
  const box = new state.Token('html_inline', '', 0);
  box.content = `<input type="checkbox" disabled${match[1] === ' ' ? '' : ' checked'} /> `;
  inline.content = inline.content.slice(match[0].length);
  const first = inline.children?.[0];
  if (first?.type === 'text') first.content = first.content.slice(match[0].length);
  inline.children?.unshift(box);
}

function convertBlocks(state: StateCore): void {
  for (let index = 0; index < state.tokens.length; index++) {
    const { type } = state.tokens[index];
    if (type === 'blockquote_open') turnIntoAlert(state, index);
    if (type === 'list_item_open') turnIntoTask(state, index);
  }
}

// Positions, headings, table alignment

function addSourcePositions(state: StateCore): void {
  const { bodyStartLine } = state.env as unknown as RenderEnv;
  for (const token of state.tokens) {
    if (!token.map || token.nesting === -1 || token.hidden) continue;
    const [start, end] = token.map;
    token.attrSet('data-sourcepos', `${start + 1 + bodyStartLine}:1-${end + bodyStartLine}:1`);
  }
}

const inlineText = (token: Token | undefined): string =>
  (token?.children ?? [])
    .filter((child) => child.type === 'text' || child.type === 'code_inline')
    .map((child) => child.content)
    .join('');

function numberHeadings(state: StateCore): void {
  const seen = new Map<string, number>();
  state.tokens.forEach((token, index) => {
    if (token.type !== 'heading_open') return;
    const base = slugify(inlineText(state.tokens[index + 1]));
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    token.meta = { slug: count === 0 ? base : `${base}-${count}` };
  });
}

function alignmentAsAttribute(state: StateCore): void {
  for (const token of state.tokens) {
    const align = /text-align:(\w+)/.exec(String(token.attrGet('style') ?? ''))?.[1];
    if (!align) continue;
    token.attrs = token.attrs?.filter(([name]) => name !== 'style') ?? null;
    token.attrSet('align', align);
  }
}

// Renderer

function renderFence(tokens: Token[], index: number, md: MarkdownIt): string {
  const token = tokens[index];
  const language = token.info.trim().split(/\s+/)[0];
  const code = language ? `<code class="language-${escapeHtml(language)}">` : '<code>';
  return `<pre${md.renderer.renderAttrs(token)}>${code}${escapeHtml(token.content)}</code></pre>\n`;
}

function renderHeadingOpen(tokens: Token[], index: number, md: MarkdownIt): string {
  const slug = escapeHtml((tokens[index].meta as { slug: string }).slug);
  const anchor = `<a href="#${slug}" aria-hidden="true" class="anchor" id="${slug}"></a>`;
  return md.renderer.renderToken(tokens, index, md.options) + anchor;
}

export function applyComrakConventions(md: MarkdownIt): void {
  md.inline.ruler.before('escape', 'math', mathInline);
  md.block.ruler.before('fence', 'math', mathBlock, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });
  md.core.ruler.push('comrak_blocks', convertBlocks);
  md.core.ruler.push('comrak_headings', numberHeadings);
  md.core.ruler.push('comrak_align', alignmentAsAttribute);
  md.core.ruler.push('comrak_sourcepos', addSourcePositions);
  md.renderer.rules.math = (tokens, index) => renderMath(tokens[index], md);
  md.renderer.rules.fence = (tokens, index) => renderFence(tokens, index, md);
  md.renderer.rules.heading_open = (tokens, index) => renderHeadingOpen(tokens, index, md);
}
