import type { MarkdownRenderer } from '$lib/ports';
import type { ColorScheme } from './colorScheme';
import { enhance } from './enhance';
import { parseFrontMatter, type FrontMatterEntry } from './frontMatter';
import { resolveLocalImages, type ImageSources } from './localImages';
import { sanitize } from './sanitize';

export interface RenderOptions {
  readonly scheme: ColorScheme;
  readonly diagramErrorLabel: string;
  /** Where local images are looked for and how they reach the webview. */
  readonly images: ImageSources;
}

export interface RenderedDocument {
  /** Detached container with the sanitised, enhanced document. */
  readonly root: HTMLElement;
  readonly properties: readonly FrontMatterEntry[];
}

/** Markdown → sanitised, enhanced DOM, built off-screen so views can swap it in whole. */
export async function renderDocument(
  renderer: MarkdownRenderer,
  markdown: string,
  options: RenderOptions,
): Promise<RenderedDocument> {
  const { html, frontMatter } = await renderer.render(markdown);
  const root = document.createElement('div');
  root.innerHTML = sanitize(html);
  resolveLocalImages(root, options.images);
  await enhance(root, { scheme: options.scheme, diagramErrorLabel: options.diagramErrorLabel });
  return { root, properties: frontMatter === null ? [] : parseFrontMatter(frontMatter) };
}
