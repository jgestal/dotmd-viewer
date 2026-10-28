import { splitFrontMatter } from '../../domain/markdownLines';
import type { MarkdownRenderer, RenderedMarkdown } from '../../ports';

const escapeHtml = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** Deterministic stand-in for comrak: the body, escaped, in one `<p>`; front matter is split off. */
export class MemoryRenderer implements MarkdownRenderer {
  /** Every text rendered, in order. */
  readonly rendered: string[] = [];

  async render(markdown: string): Promise<RenderedMarkdown> {
    this.rendered.push(markdown);
    const { frontMatter, body } = splitFrontMatter(markdown);
    return { html: `<p>${escapeHtml(body)}</p>`, frontMatter };
  }
}
