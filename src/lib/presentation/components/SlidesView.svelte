<script lang="ts">
  import { untrack } from 'svelte';
  import 'katex/dist/katex.min.css';
  import '../styles/document.css';
  import { dirName } from '$lib/domain/paths';
  import { slideAtLine, splitSlides } from '$lib/domain/slides';
  import { app } from '../app.svelte';
  import { showPreviewMenu } from '../contextMenu/documentActions';
  import { i18n } from '../i18n/i18n.svelte';
  import { notifier } from '../toasts.svelte';
  import { navigation } from '../navigation.svelte';
  import { effectiveScheme, SYSTEM_DARK_QUERY } from '../preview/colorScheme';
  import { bindLinks } from '../preview/enhance';
  import { renderDocument } from '../preview/renderDocument';
  import {
    actionForKey,
    clampIndex,
    fitScale,
    indexAfter,
    STAGE_HEIGHT,
    STAGE_WIDTH,
  } from '../slides/slideControls';
  import { recalledSlide, rememberSlide } from '../slides/slideMemory';
  import Icon from './Icon.svelte';

  // The slides layout: the document split at `---`, one 16:9 stage scaled to fit, a bar with
  // previous/next and the counter, and a real full-screen mode for presenting.
  const EDIT_DEBOUNCE_MS = 120;
  const CURSOR_IDLE_MS = 2000;
  const STAGE_MARGIN = 24;

  let root = $state<HTMLElement>();
  let host = $state<HTMLElement>();
  let stage = $state<HTMLElement>();
  let hostSize = $state({ width: 0, height: 0 });
  let systemIsDark = $state(matchMedia(SYSTEM_DARK_QUERY).matches);
  let fullscreen = $state(false);
  let cursorIdle = $state(false);
  let index = $state(0);
  let rendered = $state<readonly string[]>([]);

  const content = $derived(app.document?.content ?? '');
  const path = $derived(app.document?.path ?? null);
  const documentDir = $derived(path === null ? null : dirName(path));
  const scheme = $derived(effectiveScheme(app.preferences.theme, systemIsDark));
  const slides = $derived(splitSlides(content));
  const current = $derived(clampIndex(index, slides.length));
  const scale = $derived(
    fitScale(hostSize.width - 2 * STAGE_MARGIN, hostSize.height - 2 * STAGE_MARGIN),
  );

  let restoredPath: string | null | undefined;
  let handledId = navigation.reveal?.id ?? 0;
  let cursorTimer: ReturnType<typeof setTimeout> | undefined;

  function goTo(target: number): void {
    index = clampIndex(target, slides.length);
    rememberSlide(path, index);
  }

  const move = (action: Parameters<typeof indexAfter>[0]) =>
    goTo(indexAfter(action, current, slides.length));

  async function renderSlides(
    markdowns: readonly string[],
    colors: typeof scheme,
  ): Promise<readonly string[]> {
    const options = {
      scheme: colors,
      diagramErrorLabel: i18n.t('preview.diagramError'),
      images: { documentDir, assetUrls: app.container.assetUrls },
    };
    const pieces = await Promise.all(
      markdowns.map((markdown) => renderDocument(app.container.renderer, markdown, options)),
    );
    return pieces.map(({ root }) => root.innerHTML);
  }

  let latest = 0;
  async function refresh(markdowns: readonly string[], colors: typeof scheme): Promise<void> {
    const ticket = ++latest;
    try {
      const html = await renderSlides(markdowns, colors);
      if (ticket === latest) rendered = html;
    } catch {
      notifier.error(i18n.t('preview.renderError'));
    }
  }

  async function togglePresenting(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await host?.requestFullscreen();
    } catch {
      notifier.error(i18n.t('slides.fullscreenFailed'));
    }
  }

  /** Keys reach the slides when the view has focus or nothing in particular does. */
  const ownsKeyboard = (event: KeyboardEvent): boolean => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return false;
    const focused = document.activeElement;
    return !focused || focused === document.body || !!root?.contains(focused);
  };

  function onKeydown(event: KeyboardEvent): void {
    if (!ownsKeyboard(event)) return;
    const action = actionForKey(event.key, event.shiftKey);
    if (!action) return;
    // Escape leaves full screen by itself; here it only has to be left alone.
    if (action === 'exit') return;
    event.preventDefault();
    move(action);
  }

  function wakeCursor(): void {
    cursorIdle = false;
    clearTimeout(cursorTimer);
    if (fullscreen) cursorTimer = setTimeout(() => (cursorIdle = true), CURSOR_IDLE_MS);
  }

  function onStageClick(event: MouseEvent): void {
    if (fullscreen && !(event.target as Element).closest('a')) move('next');
  }

  $effect(() => {
    const query = matchMedia(SYSTEM_DARK_QUERY);
    const follow = () => (systemIsDark = query.matches);
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  });

  $effect(() => {
    const onChange = () => {
      fullscreen = document.fullscreenElement === host;
      wakeCursor();
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      clearTimeout(cursorTimer);
    };
  });

  $effect(() => {
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) hostSize = { width: entry.contentRect.width, height: entry.contentRect.height };
    });
    observer.observe(host);
    return () => observer.disconnect();
  });

  $effect(() => {
    const markdowns = slides.map((slide) => slide.markdown);
    const colors = scheme;
    const timer = setTimeout(() => void refresh(markdowns, colors), EDIT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  });

  // Opening a document lands on the slide it was last on, or the one at the outline's position.
  $effect(() => {
    const forPath = path;
    if (forPath === restoredPath) return;
    restoredPath = forPath;
    untrack(() => {
      index = clampIndex(
        recalledSlide(forPath) ?? slideAtLine(slides, navigation.topLine),
        slides.length,
      );
    });
  });

  $effect(() => {
    navigation.reportTopLine(slides[current]?.startLine ?? 0);
  });

  $effect(() => {
    const request = navigation.reveal;
    if (!request || request.id === handledId) return;
    handledId = request.id;
    untrack(() => goTo(slideAtLine(slides, request.line)));
  });

  $effect(() => {
    if (!stage) return;
    void rendered;
    return bindLinks(stage, {
      documentDir,
      onOpenLink: (target) => {
        if (target.kind === 'document') void app.open(target.path);
        else void app.openExternal(target.url);
      },
    });
  });
</script>

<svelte:window onkeydown={onKeydown} />

<div class="slides" bind:this={root} style:--doc-zoom={app.preferences.zoom}>
  <!-- Clicking only adds a pointer shortcut in full screen; the keys do the same. -->
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div
    class="host"
    class:fullscreen
    class:idle={cursorIdle}
    bind:this={host}
    onpointermove={wakeCursor}
    onclick={onStageClick}
    oncontextmenu={(event) => void showPreviewMenu(event)}
  >
    {#if slides.length === 0}
      <p class="empty">{i18n.t('slides.empty')}</p>
    {:else}
      <div
        class="frame"
        style:width="{STAGE_WIDTH * scale}px"
        style:height="{STAGE_HEIGHT * scale}px"
        role="region"
        aria-label={i18n.t('slides.stage')}
      >
        <div
          class="stage"
          style:width="{STAGE_WIDTH}px"
          style:height="{STAGE_HEIGHT}px"
          style:transform="scale({scale})"
        >
          <article class="markdown-body slide" bind:this={stage}>
            <!-- Sanitised by the render pipeline. -->
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html rendered[current] ?? ''}
          </article>
        </div>
      </div>
    {/if}
  </div>

  {#if !fullscreen}
    <div class="bar">
      <button
        class="tb"
        title={i18n.t('slides.previous')}
        aria-label={i18n.t('slides.previous')}
        disabled={current === 0}
        onclick={() => move('previous')}
      >
        <span class="flip"><Icon name="chevron" /></span>
      </button>
      <span class="counter" aria-live="polite">
        {i18n.t('slides.counter', {
          current: slides.length === 0 ? 0 : current + 1,
          total: slides.length,
        })}
      </span>
      <button
        class="tb"
        title={i18n.t('slides.next')}
        aria-label={i18n.t('slides.next')}
        disabled={current >= slides.length - 1}
        onclick={() => move('next')}
      >
        <Icon name="chevron" />
      </button>
      <button
        class="btn present"
        disabled={slides.length === 0}
        onclick={() => void togglePresenting()}>{i18n.t('slides.present')}</button
      >
    </div>
  {/if}
</div>

<style>
  .slides {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .host {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: var(--bg-sidebar);
  }

  .host.fullscreen {
    background: var(--bg);
  }

  .host.idle {
    cursor: none;
  }

  .frame {
    position: relative;
    flex-shrink: 0;
    overflow: hidden;
    border-radius: 6px;
    background: var(--bg);
    box-shadow: 0 2px 18px rgba(0, 0, 0, 0.18);
  }

  .fullscreen .frame {
    border-radius: 0;
    box-shadow: none;
  }

  .stage {
    position: absolute;
    inset: 0 auto auto 0;
    transform-origin: top left;
    font-size: calc(28px * var(--doc-zoom, 1));
  }

  .slide {
    box-sizing: border-box;
    height: 100%;
    padding: 64px 88px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
  }

  .slide :global(h1) {
    font-size: 2.4em;
    line-height: 1.15;
    border-bottom: 0;
  }

  .slide :global(h2) {
    font-size: 1.8em;
    line-height: 1.2;
    border-bottom: 0;
  }

  .slide :global(h3) {
    font-size: 1.3em;
  }

  .empty {
    color: var(--fg-muted);
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 8px 12px;
    border-top: 1px solid var(--border);
    background: var(--bg);
    font-size: 12px;
  }

  .counter {
    min-width: 64px;
    text-align: center;
    color: var(--fg-muted);
    font-variant-numeric: tabular-nums;
  }

  .tb:disabled {
    opacity: 0.35;
  }

  .flip {
    display: inline-flex;
    transform: scaleX(-1);
  }

  .present {
    margin-left: 12px;
    padding: 3px 12px;
  }
</style>
