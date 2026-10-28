import katex from 'katex';
import type { ColorScheme } from './colorScheme';
import { highlightCode } from './highlight';
import { classifyLink, type LinkTarget } from './links';
import { drawDiagram } from './mermaid';

export interface EnhanceOptions {
  readonly scheme: ColorScheme;
  /** Heading shown above the message when a diagram cannot be drawn. */
  readonly diagramErrorLabel: string;
}

const LANGUAGE_CLASS = /(?:^|\s)language-([\w+#-]+)/;

const languageOf = (code: Element): string =>
  (LANGUAGE_CLASS.exec(code.className)?.[1] ?? '').toLowerCase();

function renderMath(container: HTMLElement): void {
  for (const span of container.querySelectorAll<HTMLElement>('[data-math-style]')) {
    katex.render(span.textContent ?? '', span, {
      displayMode: span.dataset.mathStyle === 'display',
      throwOnError: false,
    });
    span.classList.add('math-rendered');
  }
}

function highlight(code: HTMLElement, language: string): void {
  const html = highlightCode(code.textContent ?? '', language);
  if (html === null) return;
  code.innerHTML = html;
  code.classList.add('hljs');
}

async function drawInto(holder: HTMLElement, source: string, options: EnhanceOptions) {
  const result = await drawDiagram(source, options.scheme);
  if (result.ok) {
    holder.innerHTML = result.svg;
    return;
  }
  const message = document.createElement('pre');
  message.textContent = result.message;
  holder.classList.add('mermaid-error');
  holder.replaceChildren(options.diagramErrorLabel, message);
}

/** Turns a `language-mermaid` block into a holder that keeps its source position. */
function diagramHolder(pre: HTMLElement): HTMLElement {
  const holder = document.createElement('div');
  holder.className = 'mermaid-diagram';
  const position = pre.getAttribute('data-sourcepos');
  if (position) holder.setAttribute('data-sourcepos', position);
  pre.replaceWith(holder);
  return holder;
}

/**
 * Post-processes sanitised HTML: KaTeX for maths, highlight.js for code, Mermaid for diagrams
 * (loaded only when the document has one). Works on a detached container, so the caller can
 * swap the finished result in at once.
 */
export async function enhance(container: HTMLElement, options: EnhanceOptions): Promise<void> {
  renderMath(container);
  const diagrams: Promise<void>[] = [];
  for (const code of container.querySelectorAll<HTMLElement>('pre > code')) {
    const language = languageOf(code);
    const pre = code.parentElement!;
    if (language === 'mermaid') {
      diagrams.push(drawInto(diagramHolder(pre), code.textContent ?? '', options));
    } else if (language) {
      highlight(code, language);
    }
  }
  await Promise.all(diagrams);
}

export interface LinkOptions {
  /** Folder of the open document, used to resolve relative links. */
  readonly documentDir: string | null;
  readonly onOpenLink: (target: Exclude<LinkTarget, { kind: 'anchor' }>) => void;
}

const scrollToId = (root: HTMLElement, id: string): void => {
  const element = [...root.querySelectorAll('[id]')].find((candidate) => candidate.id === id);
  element?.scrollIntoView({ block: 'start' });
};

/**
 * Handles clicks on links inside `root`: anchors scroll within it, everything else goes to
 * `onOpenLink`. Links are never followed by the webview itself. Returns the function that
 * removes the listener.
 */
export function bindLinks(root: HTMLElement, options: LinkOptions): () => void {
  const onClick = (event: MouseEvent): void => {
    const link = (event.target as Element).closest('a[href]');
    if (!link) return;
    event.preventDefault();
    const target = classifyLink(link.getAttribute('href') ?? '', options.documentDir);
    if (target?.kind === 'anchor') scrollToId(root, target.id);
    else if (target) options.onOpenLink(target);
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
