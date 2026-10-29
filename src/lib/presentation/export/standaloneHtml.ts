// Assembly of the standalone HTML page: one file with its styles inline and nothing to fetch.

import type { ShownTheme } from '$lib/domain/theme';

export interface StandalonePage {
  readonly title: string;
  readonly lang: string;
  /** The look the page is frozen in; "system" has been resolved to light or dark. */
  readonly theme: ShownTheme;
  /** All the styles of the page, already concatenated. */
  readonly css: string;
  /** The rendered, sanitised document. */
  readonly body: string;
}

const FONT_FACE = /@font-face\s*\{[^}]*\}/g;

/** The page chrome around the document: a centred reading column on the theme's background. */
export const PAGE_CSS = `
html { background: var(--bg); }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 var(--font-ui); }
main { max-width: 860px; margin: 0 auto; padding: 48px 24px 96px; }
.markdown-body img, .markdown-body svg { max-width: 100%; height: auto; }
`;

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

const escapeHtml = (text: string): string => text.replace(/[&<>"]/g, (char) => HTML_ESCAPES[char]);

/**
 * KaTeX's stylesheet without its `@font-face` rules: they point at font files beside the app,
 * which a single file cannot carry, so maths is drawn with the reader's system fonts instead.
 */
export const withoutFontFaces = (css: string): string => css.replace(FONT_FACE, '');

/** A complete HTML document: doctype, charset, title, inline styles and the document in `<main>`. */
export function standaloneHtml({ title, lang, theme, css, body }: StandalonePage): string {
  return [
    '<!doctype html>',
    `<html lang="${escapeHtml(lang)}" data-theme="${theme}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="generator" content="SimpleDotMD">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${css}</style>`,
    '</head>',
    '<body>',
    `<main class="markdown-body">${body}</main>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
