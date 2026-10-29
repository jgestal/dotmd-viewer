// The document as a standalone HTML page. It goes through the same pipeline as the preview and
// the PDF (renderDocument: sanitised HTML, KaTeX, Mermaid as inline SVG, highlight.js classes);
// only the images differ: they are embedded rather than loaded.
import documentCss from '../styles/document.css?inline';
import tokensCss from '../styles/tokens.css?inline';
import katexCss from 'katex/dist/katex.min.css?inline';
import type { ShownTheme } from '$lib/domain/theme';
import type { AssetUrls, FileSystem, MarkdownRenderer } from '$lib/ports';
import { effectiveScheme } from '../preview/colorScheme';
import { renderDocument } from '../preview/renderDocument';
import { inlineLocalImages } from './inlineImages';
import { PAGE_CSS, standaloneHtml, withoutFontFaces } from './standaloneHtml';

export interface StandaloneOptions {
  readonly title: string;
  readonly lang: string;
  readonly theme: ShownTheme;
  readonly diagramErrorLabel: string;
  readonly documentDir: string | null;
}

/** Leaves local image references as written, for `inlineLocalImages` to read from disk. */
const keepReferences: AssetUrls = { toUrl: () => null };

export async function renderStandaloneHtml(
  renderer: MarkdownRenderer,
  fs: Pick<FileSystem, 'readBase64'>,
  markdown: string,
  options: StandaloneOptions,
): Promise<string> {
  const { title, lang, theme, documentDir } = options;
  const { root } = await renderDocument(renderer, markdown, {
    scheme: effectiveScheme(theme, false),
    diagramErrorLabel: options.diagramErrorLabel,
    images: { documentDir, assetUrls: keepReferences },
  });
  await inlineLocalImages(root, { documentDir, fs });
  const css = [tokensCss, documentCss, withoutFontFaces(katexCss), PAGE_CSS].join('\n');
  return standaloneHtml({ title, lang, theme, css, body: root.innerHTML });
}
