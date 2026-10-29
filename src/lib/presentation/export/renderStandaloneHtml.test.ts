import { describe, expect, it, vi } from 'vitest';
import { MemoryFileSystem, MemoryRenderer } from '$lib/infrastructure/memory';
import type { MarkdownRenderer } from '$lib/ports';
import { renderStandaloneHtml } from './renderStandaloneHtml';

// Vitest does not process stylesheets, so each one is stood in for by a recognisable string.
vi.mock('../styles/tokens.css?inline', () => ({ default: '/*tokens*/' }));
vi.mock('../styles/document.css?inline', () => ({ default: '/*document*/' }));
vi.mock('katex/dist/katex.min.css?inline', () => ({
  default: '@font-face{src:url(fonts/KaTeX_Main.woff2)}/*katex*/',
}));

const options = {
  title: 'Notes',
  lang: 'en',
  theme: 'dark',
  diagramErrorLabel: 'diagram error',
  documentDir: '/d',
} as const;

const htmlRenderer = (html: string): MarkdownRenderer => ({
  render: async () => ({ html, frontMatter: null }),
});

describe('renderStandaloneHtml', () => {
  it('wraps the rendered document in a page with the app, document and KaTeX styles inline', async () => {
    const page = await renderStandaloneHtml(
      new MemoryRenderer(),
      new MemoryFileSystem(),
      'Hello',
      options,
    );
    expect(page.startsWith('<!doctype html>')).toBe(true);
    expect(page).toContain('<title>Notes</title>');
    expect(page).toContain('<html lang="en" data-theme="dark">');
    expect(page).toContain('<main class="markdown-body"><p>Hello</p></main>');
    expect(page).toContain('<style>/*tokens*/\n/*document*/\n/*katex*/\n');
    expect(page).not.toContain('@font-face');
    expect(page).not.toContain('KaTeX_Main');
  });

  it('renders maths to KaTeX markup', async () => {
    const renderer = htmlRenderer('<span data-math-style="inline">x^2</span>');
    const page = await renderStandaloneHtml(renderer, new MemoryFileSystem(), '', options);
    expect(page).toContain('class="katex"');
  });

  it('highlights code with highlight.js classes', async () => {
    const renderer = htmlRenderer('<pre><code class="language-js">const a = 1;</code></pre>');
    const page = await renderStandaloneHtml(renderer, new MemoryFileSystem(), '', options);
    expect(page).toContain('hljs-keyword');
  });

  it('embeds local images and leaves remote ones alone', async () => {
    const fs = new MemoryFileSystem();
    fs.seedBinary('/d/pic.png', new Uint8Array([1, 2, 3]));
    const renderer = htmlRenderer('<img src="pic.png"><img src="https://example.com/r.png">');
    const page = await renderStandaloneHtml(renderer, fs, '', options);
    expect(page).toContain('<img src="data:image/png;base64,AQID">');
    expect(page).toContain('<img src="https://example.com/r.png">');
  });

  it('removes scripts from the document', async () => {
    const renderer = htmlRenderer('<p>ok</p><script>alert(1)</script>');
    const page = await renderStandaloneHtml(renderer, new MemoryFileSystem(), '', options);
    expect(page).not.toContain('alert(1)');
  });
});
