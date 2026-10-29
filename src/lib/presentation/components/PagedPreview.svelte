<script lang="ts">
  import { tick, untrack } from 'svelte';
  import 'katex/dist/katex.min.css';
  import '../styles/document.css';
  import { dirName } from '$lib/domain/paths';
  import { app } from '../app.svelte';
  import { showPreviewMenu } from '../contextMenu/documentActions';
  import { i18n } from '../i18n/i18n.svelte';
  import { notifier } from '../toasts.svelte';
  import { throttle } from '../navigation';
  import { navigation } from '../navigation.svelte';
  import { effectiveScheme, type ColorScheme, SYSTEM_DARK_QUERY } from '../preview/colorScheme';
  import { bindLinks } from '../preview/enhance';
  import { renderDocument } from '../preview/renderDocument';
  import { revealLine, topLine } from '../preview/viewNavigation';
  import { measureBlocks } from '../pages/measure';
  import { paginate, type PageRange } from '../pages/paginate';
  import { fitScale, sheetGeometry, type PageSize } from '../pages/sheet';

  // The read-only document laid out on sheets of paper (A4 or Letter) on a grey desk, with the
  // page number at the foot of each. Blocks are measured off-screen at the sheet's content width
  // and distributed by the pure `paginate`. Sheets are laid out at their real size and scaled
  // with CSS (fit-to-width times the user's zoom), so zooming or resizing the window never
  // changes where the pages break; only the document and the page size do.
  const EDIT_DEBOUNCE_MS = 120;
  const REPORT_INTERVAL_MS = 100;
  const PAGE_SIZES: readonly PageSize[] = ['a4', 'letter'];
  const DESK_PADDING_PX = 24;

  let desk = $state<HTMLElement>();
  let sheets = $state<HTMLElement>();
  let measurer = $state<HTMLElement>();
  let deskWidth = $state(0);
  let blocks = $state.raw<readonly Element[]>([]);
  let ranges = $state.raw<readonly PageRange[]>([{ start: 0, end: 0 }]);
  let systemIsDark = $state(matchMedia(SYSTEM_DARK_QUERY).matches);

  const content = $derived(app.document?.content ?? '');
  const path = $derived(app.document?.path ?? null);
  const documentDir = $derived(path === null ? null : dirName(path));
  const scheme = $derived(effectiveScheme(app.preferences.theme, systemIsDark));
  const geometry = $derived(sheetGeometry(app.preferences.pageSize));
  const scale = $derived(
    fitScale(deskWidth - 2 * DESK_PADDING_PX, geometry.width) * app.preferences.zoom,
  );

  let renderedPath: string | null | undefined;
  let latest = 0;
  // A reveal asked for before the first layout has produced anything to scroll to.
  let pendingReveal: number | null = null;
  // Requests issued before this view existed are stale.
  let handledId = navigation.reveal?.id ?? 0;

  /** Puts the blocks of one sheet into its body. */
  function fill(node: HTMLElement, sheet: { blocks: readonly Element[]; range: PageRange }) {
    const place = ({ blocks: all, range }: typeof sheet) =>
      node.replaceChildren(...all.slice(range.start, range.end));
    place(sheet);
    return { update: place };
  }

  function layout(): void {
    if (!measurer) return;
    // The blocks are built off-screen and moved in whole, as in the continuous view.
    // eslint-disable-next-line svelte/no-dom-manipulating
    measurer.replaceChildren(...blocks);
    ranges = paginate(measureBlocks(measurer, blocks), geometry.contentHeight);
  }

  /** Scrolls to the zero-based source line; stays pending until there is something to scroll to. */
  function reveal(line: number): void {
    if (desk && sheets && revealLine(desk, sheets, line)) pendingReveal = null;
  }

  const reportTopLine = throttle(() => {
    if (desk && sheets) navigation.reportTopLine(topLine(desk, sheets));
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
        images: { documentDir, assetUrls: app.container.assetUrls },
      });
      if (ticket !== latest || !desk) return;
      const top = forPath === renderedPath ? desk.scrollTop : 0;
      blocks = [...next.root.children];
      layout();
      renderedPath = forPath;
      await tick();
      if (ticket !== latest || !desk) return;
      desk.scrollTop = top;
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
    if (!desk) return;
    const observer = new ResizeObserver(([entry]) => (deskWidth = entry.contentRect.width));
    observer.observe(desk);
    return () => observer.disconnect();
  });

  $effect(() => {
    const markdown = content;
    const forPath = path;
    const colors = scheme;
    const delay = forPath === renderedPath ? EDIT_DEBOUNCE_MS : 0;
    const timer = setTimeout(() => void render(markdown, forPath, colors), delay);
    return () => clearTimeout(timer);
  });

  // Another page size changes the content box the blocks flow in: paginate again.
  $effect(() => {
    void geometry;
    untrack(layout);
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
    if (!desk) return;
    return bindLinks(desk, {
      documentDir,
      onOpenLink: (target) => {
        if (target.kind === 'document') void app.open(target.path);
        else void app.openExternal(target.url);
      },
    });
  });
</script>

<div class="paged">
  <div class="segmented size-switch" role="radiogroup" aria-label={i18n.t('pages.pageSize')}>
    {#each PAGE_SIZES as size (size)}
      <button
        role="radio"
        aria-checked={app.preferences.pageSize === size}
        onclick={() => app.setPreference('pageSize', size)}>{i18n.t(`pages.size.${size}`)}</button
      >
    {/each}
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="desk"
    bind:this={desk}
    onscroll={reportTopLine}
    oncontextmenu={(event) => void showPreviewMenu(event)}
  >
    <div
      class="sheets"
      bind:this={sheets}
      style:--sheet-w="{geometry.width}px"
      style:--sheet-h="{geometry.height}px"
      style:--sheet-margin="{geometry.margin}px"
      style:--scale={scale}
    >
      {#each ranges as range, index (index)}
        <div class="slot">
          <section
            class="sheet"
            aria-label={i18n.t('pages.pageNumber', { page: index + 1, total: ranges.length })}
          >
            <div class="sheet-body markdown-body" use:fill={{ blocks, range }}></div>
            <footer class="page-number">{index + 1} / {ranges.length}</footer>
          </section>
        </div>
      {/each}
    </div>
  </div>

  <div
    class="measurer markdown-body"
    aria-hidden="true"
    bind:this={measurer}
    style:width="{geometry.contentWidth}px"
  ></div>
</div>

<style>
  .paged {
    position: relative;
    height: 100%;
    overflow: hidden;
  }

  .size-switch {
    position: absolute;
    top: 12px;
    right: 24px;
    z-index: 1;
    border: 1px solid var(--border);
    background: var(--bg-elev);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .size-switch :global(button[aria-checked='true']) {
    background: var(--bg-active);
  }

  .desk {
    height: 100%;
    overflow: auto;
    user-select: text;
    cursor: auto;
    background: color-mix(in srgb, var(--fg) 12%, var(--bg-sidebar));
  }

  .sheets {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(24px * var(--scale));
    padding: 24px;
  }

  /* Takes the scaled size of a sheet in the flow; the sheet itself keeps its real size. */
  .slot {
    flex: none;
    width: calc(var(--sheet-w) * var(--scale));
    height: calc(var(--sheet-h) * var(--scale));
  }

  .sheet {
    position: relative;
    box-sizing: border-box;
    width: var(--sheet-w);
    height: var(--sheet-h);
    padding: var(--sheet-margin);
    background: var(--bg);
    color: var(--fg);
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.2),
      0 8px 24px rgba(0, 0, 0, 0.18);
    transform: scale(var(--scale));
    transform-origin: top left;
    font-size: 15px;
  }

  .sheet-body {
    display: flow-root;
    height: 100%;
  }

  .sheet-body > :global(:first-child) {
    margin-top: 0;
  }

  .page-number {
    position: absolute;
    right: 0;
    bottom: calc(var(--sheet-margin) / 2 - 0.6em);
    left: 0;
    color: var(--fg-muted);
    font: 11px/1 var(--font-ui);
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  /* Never shown: the blocks are laid out here only to be measured, at the content width of a
     sheet and with the same typography. */
  .measurer {
    position: absolute;
    top: 0;
    left: 0;
    display: flow-root;
    visibility: hidden;
    pointer-events: none;
    font-size: 15px;
  }

  .measurer > :global(:first-child) {
    margin-top: 0;
  }
</style>
