<script lang="ts">
  import { untrack } from 'svelte';
  import 'katex/dist/katex.min.css';
  import '../styles/document.css';
  import { dirName } from '$lib/domain/paths';
  import { app } from '../app.svelte';
  import { i18n } from '../i18n/i18n.svelte';
  import { notifier } from '../toasts.svelte';
  import { effectiveScheme, type ColorScheme, SYSTEM_DARK_QUERY } from '../preview/colorScheme';
  import { bindLinks } from '../preview/enhance';
  import type { FrontMatterEntry } from '../preview/frontMatter';
  import { renderDocument } from '../preview/renderDocument';
  import { revealLine, topLine } from '../preview/viewNavigation';
  import { throttle } from '../navigation';
  import { navigation } from '../navigation.svelte';

  // The continuous, read-only rendering of the open document. Typing re-renders after a short
  // pause; opening another document renders at once. Each render is built off-screen and swapped
  // in whole, so the scroll position survives it.
  const EDIT_DEBOUNCE_MS = 120;
  const REPORT_INTERVAL_MS = 100;

  // Embedding: the split view reads the scroller, hears scrolls, and leaves reporting the top
  // line to the editor.
  let {
    scroller = $bindable(),
    reportsTopLine = true,
    onScroll,
  }: {
    scroller?: HTMLElement;
    reportsTopLine?: boolean;
    onScroll?: () => void;
  } = $props();

  let article = $state<HTMLElement>();
  let properties = $state<readonly FrontMatterEntry[]>([]);
  let systemIsDark = $state(matchMedia(SYSTEM_DARK_QUERY).matches);

  const content = $derived(app.document?.content ?? '');
  const path = $derived(app.document?.path ?? null);
  const documentDir = $derived(path === null ? null : dirName(path));
  const scheme = $derived(effectiveScheme(app.preferences.theme, systemIsDark));

  let renderedPath: string | null | undefined;
  let latest = 0;
  // A reveal asked for before the first render has produced anything to scroll to.
  let pendingReveal: number | null = null;
  // Requests issued before this view existed are stale.
  let handledId = navigation.reveal?.id ?? 0;

  /** Scrolls to the zero-based source line; stays pending until there is something to scroll to. */
  function reveal(line: number): void {
    if (scroller && article && revealLine(scroller, article, line)) pendingReveal = null;
  }

  const reportTopLine = throttle(() => {
    if (reportsTopLine && scroller && article) navigation.reportTopLine(topLine(scroller, article));
  }, REPORT_INTERVAL_MS);

  async function render(
    markdown: string,
    forPath: string | null,
    colors: ColorScheme,
  ): Promise<void> {
    const ticket = ++latest;
    try {
      const next = await renderDocument(app.container.renderer, markdown, {
        scheme: colors,
        diagramErrorLabel: i18n.t('preview.diagramError'),
      });
      if (ticket !== latest || !scroller || !article) return;
      const top = forPath === renderedPath ? scroller.scrollTop : 0;
      // The article is empty in the template: the post-processed document is swapped in whole.
      // eslint-disable-next-line svelte/no-dom-manipulating
      article.replaceChildren(...next.root.childNodes);
      properties = next.properties;
      scroller.scrollTop = top;
      renderedPath = forPath;
      if (pendingReveal !== null) reveal(pendingReveal);
    } catch {
      notifier.error(i18n.t('preview.renderError'));
    }
  }

  $effect(() => {
    const query = matchMedia(SYSTEM_DARK_QUERY);
    const follow = () => (systemIsDark = query.matches);
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  });

  $effect(() => {
    const markdown = content;
    const forPath = path;
    const colors = scheme;
    const delay = forPath === renderedPath ? EDIT_DEBOUNCE_MS : 0;
    const timer = setTimeout(() => void render(markdown, forPath, colors), delay);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    const request = navigation.reveal;
    if (!request || request.id === handledId) return;
    handledId = request.id;
    untrack(() => {
      pendingReveal = request.line;
      reveal(request.line);
    });
  });

  $effect(() => {
    if (!article) return;
    return bindLinks(article, {
      documentDir,
      onOpenLink: (target) => {
        if (target.kind === 'document') void app.open(target.path);
        else void app.openExternal(target.url);
      },
    });
  });
</script>

<div
  class="scroller"
  bind:this={scroller}
  onscroll={() => {
    reportTopLine();
    onScroll?.();
  }}
  style:--doc-zoom={app.preferences.zoom}
>
  <div class="document">
    {#if properties.length > 0}
      <details class="properties">
        <summary>{i18n.t('preview.properties')}</summary>
        <dl>
          {#each properties as { key, value } (key)}
            <dt>{key}</dt>
            <dd>{value}</dd>
          {/each}
        </dl>
      </details>
    {/if}
    <article class="markdown-body" bind:this={article}></article>
  </div>
</div>

<style>
  .scroller {
    height: 100%;
    overflow: auto;
    user-select: text;
    cursor: auto;
  }

  .document {
    box-sizing: content-box;
    max-width: 72ch;
    margin: 0 auto;
    padding: 32px 40px 60vh;
    font-size: calc(16px * var(--doc-zoom, 1));
  }

  .properties {
    margin-bottom: 1.5em;
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-elev);
    color: var(--fg-muted);
    font: 12px/1.5 var(--font-ui);
  }

  summary {
    cursor: pointer;
    font-weight: 600;
  }

  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 2px 14px;
    margin: 8px 0 4px;
  }

  dt {
    font-weight: 600;
  }

  dd {
    margin: 0;
    color: var(--fg);
    overflow-wrap: anywhere;
  }
</style>
