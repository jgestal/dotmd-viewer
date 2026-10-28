<script lang="ts">
  import { untrack } from 'svelte';
  import 'katex/dist/katex.min.css';
  import '../styles/document.css';
  import { dirName } from '$lib/domain/paths';
  import { app } from '../app.svelte';
  import { i18n } from '../i18n/i18n.svelte';
  import { notifier } from '../toasts.svelte';
  import { effectiveScheme, type ColorScheme, SYSTEM_DARK_QUERY } from '../preview/colorScheme';
  import { bindLinks, enhance } from '../preview/enhance';
  import { parseFrontMatter, type FrontMatterEntry } from '../preview/frontMatter';
  import { sanitize } from '../preview/sanitize';
  import { blockForLine, parseStartLine, topLineAt } from '../preview/sourcePositions';
  import { throttle } from '../navigation';
  import { navigation } from '../navigation.svelte';

  // The continuous, read-only rendering of the open document. Typing re-renders after a short
  // pause; opening another document renders at once. Each render is built off-screen and swapped
  // in whole, so the scroll position survives it.
  const EDIT_DEBOUNCE_MS = 120;
  const REPORT_INTERVAL_MS = 100;

  let scroller = $state<HTMLElement>();
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

  const sourceBlocks = () =>
    [...(article?.querySelectorAll('[data-sourcepos]') ?? [])].flatMap((element) => {
      const start = parseStartLine(element.getAttribute('data-sourcepos'));
      return start === null ? [] : [{ element, start }];
    });

  /** Scrolls so the block of the zero-based source line is at the top. */
  function revealLine(line: number): void {
    const block = blockForLine(sourceBlocks(), line);
    if (!block || !scroller) return;
    pendingReveal = null;
    const offset = block.element.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTop += offset;
  }

  const reportTopLine = throttle(() => {
    if (!scroller) return;
    const edge = scroller.getBoundingClientRect().top;
    const blocks = sourceBlocks().map(({ element, start }) => ({
      start,
      top: element.getBoundingClientRect().top - edge,
    }));
    navigation.reportTopLine(topLineAt(blocks, 4));
  }, REPORT_INTERVAL_MS);

  async function render(
    markdown: string,
    forPath: string | null,
    colors: ColorScheme,
  ): Promise<void> {
    const ticket = ++latest;
    try {
      const { html, frontMatter } = await app.container.renderer.render(markdown);
      const next = document.createElement('div');
      next.innerHTML = sanitize(html);
      await enhance(next, { scheme: colors, diagramErrorLabel: i18n.t('preview.diagramError') });
      if (ticket !== latest || !scroller || !article) return;
      const top = forPath === renderedPath ? scroller.scrollTop : 0;
      // The article is empty in the template: the post-processed document is swapped in whole.
      // eslint-disable-next-line svelte/no-dom-manipulating
      article.replaceChildren(...next.childNodes);
      properties = frontMatter === null ? [] : parseFrontMatter(frontMatter);
      scroller.scrollTop = top;
      renderedPath = forPath;
      if (pendingReveal !== null) revealLine(pendingReveal);
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
      if (article?.firstElementChild) revealLine(request.line);
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
  onscroll={reportTopLine}
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
