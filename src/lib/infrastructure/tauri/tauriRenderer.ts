import type { MarkdownRenderer, RenderedMarkdown } from '../../ports';
import { call } from './invoke';

/** MarkdownRenderer over the comrak-backed `render_markdown` command. */
export const tauriRenderer: MarkdownRenderer = {
  render: (markdown) => call<RenderedMarkdown>('render_markdown', { markdown }),
};
