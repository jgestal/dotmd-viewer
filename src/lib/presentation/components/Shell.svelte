<script lang="ts">
  import type { Snippet } from 'svelte';
  import { SIDEBAR_WIDTH_MAX, SIDEBAR_WIDTH_MIN } from '$lib/domain/preferences';
  import { app } from '../app.svelte';
  import { i18n } from '../i18n/i18n.svelte';
  import DropOverlay from './DropOverlay.svelte';
  import ContextMenuFallback from './ContextMenuFallback.svelte';
  import Sidebar from './Sidebar.svelte';
  import Toasts from './Toasts.svelte';
  import ViewportHeader from './ViewportHeader.svelte';

  // The window layout: sidebar | resizer | (header, viewport, status bar). Panels and the
  // viewport content are passed in, so each feature stays in its own component.
  let {
    explorer,
    favourites,
    outline,
    viewport,
    statusBar,
  }: {
    explorer: Snippet;
    favourites: Snippet;
    outline: Snippet;
    viewport: Snippet;
    statusBar: Snippet;
  } = $props();

  const KEYBOARD_STEP = 16;

  const clampWidth = (width: number): number =>
    Math.round(Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, width)));

  function startResize(event: PointerEvent): void {
    const startX = event.clientX;
    const startWidth = app.preferences.sidebarWidth;
    document.body.classList.add('resizing');
    const move = (e: PointerEvent) =>
      app.setPreference('sidebarWidth', clampWidth(startWidth + e.clientX - startX));
    const stop = () => {
      document.body.classList.remove('resizing');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  function resizeWithKeys(event: KeyboardEvent): void {
    const delta = { ArrowLeft: -KEYBOARD_STEP, ArrowRight: KEYBOARD_STEP }[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    app.setPreference('sidebarWidth', clampWidth(app.preferences.sidebarWidth + delta));
  }
</script>

<div
  class="shell"
  style:--sidebar-width="{app.preferences.sidebarVisible ? app.preferences.sidebarWidth : 0}px"
>
  {#if app.preferences.sidebarVisible}
    <Sidebar {explorer} {favourites} {outline} />
    <!-- A focusable separator is the ARIA window-splitter pattern, so it takes keys and pointer. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      class="resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={i18n.t('sidebar.resize')}
      aria-valuemin={SIDEBAR_WIDTH_MIN}
      aria-valuemax={SIDEBAR_WIDTH_MAX}
      aria-valuenow={app.preferences.sidebarWidth}
      tabindex="0"
      onpointerdown={startResize}
      onkeydown={resizeWithKeys}
    ></div>
  {/if}

  <main class="main">
    <ViewportHeader />
    <div class="viewport">{@render viewport()}</div>
    <footer class="status">{@render statusBar()}</footer>
  </main>
</div>

<DropOverlay />
<Toasts />
<ContextMenuFallback />

<style>
  .shell {
    display: grid;
    grid-template-columns: var(--sidebar-width) 0 minmax(0, 1fr);
    /* Without this the single row grows with the content and the page scrolls, not the viewport. */
    grid-template-rows: minmax(0, 1fr);
    height: 100vh;
  }

  .resizer {
    position: relative;
    z-index: 2;
    width: 0;
  }

  .resizer::after {
    content: '';
    position: absolute;
    inset: 0 -3px;
    cursor: col-resize;
  }

  .resizer:hover::after,
  .resizer:focus-visible::after {
    background: var(--accent-soft);
  }

  .main {
    grid-column: 3;
    display: grid;
    grid-template-rows: var(--header-height) minmax(0, 1fr) var(--status-height);
    min-width: 0;
  }

  .viewport {
    min-height: 0;
    overflow: auto;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 12px;
    border-top: 1px solid var(--border);
    color: var(--fg-muted);
    font-size: 11.5px;
    white-space: nowrap;
    overflow: hidden;
  }
</style>
