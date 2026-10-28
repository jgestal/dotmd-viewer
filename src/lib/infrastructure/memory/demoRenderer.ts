import MarkdownIt, { type MarkdownIt as Parser } from 'markdown-it';
import footnote from 'markdown-it-footnote';
import mark from 'markdown-it-mark';
import { splitFrontMatter } from '../../domain/markdownLines';
import type { MarkdownRenderer, RenderedMarkdown } from '../../ports';
import { applyComrakConventions, type RenderEnv } from './demoMarkdownRules';

const createParser = (): Parser => {
  const md = new MarkdownIt({ html: true, linkify: true });
  md.use(footnote).use(mark);
  applyComrakConventions(md);
  return md;
};

/** Browser-mode stand-in for comrak: markdown-it producing the same conventions. */
export class DemoRenderer implements MarkdownRenderer {
  readonly #md = createParser();

  async render(markdown: string): Promise<RenderedMarkdown> {
    const { frontMatter, body, bodyStartLine } = splitFrontMatter(markdown);
    const env: RenderEnv = { bodyStartLine };
    return { html: this.#md.render(body, env), frontMatter };
  }
}
