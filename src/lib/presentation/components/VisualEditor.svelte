<script lang="ts">
  import { untrack } from 'svelte';
  import 'katex/dist/katex.min.css';
  import '../styles/document.css';
  import { app } from '../app.svelte';
  import { i18n } from '../i18n/i18n.svelte';
  import { throttle } from '../navigation';
  import { navigation } from '../navigation.svelte';
  import { effectiveScheme, SYSTEM_DARK_QUERY } from '../preview/colorScheme';
  import { drawDiagram } from '../preview/mermaid';
  import { revealBlockLine, topBlockLine } from '../preview/viewNavigation';
  import { notifier } from '../toasts.svelte';
  import type { VisualEditor } from '../visual/milkdownEditor';

  // The editable preview: the document as it reads, edited in place (Milkdown, loaded the first
  // time this view opens). The document is the source of truth, as in the code editor: edits are
  // sent to the app, and only a text the editor did not produce (a reload, the code view) is
  // written back. Each document gets its own editor, so undo never crosses documents.
  const REPORT_INTERVAL_MS = 100;

  let scroller = $state<HTMLElement>();
  let host = $state<HTMLElement>();
  let editor = $state.raw<VisualEditor | null>(null);
  let failed = $state(false);
  // Edits sent to the app that it has not stored yet: until they settle, its text is stale.
  let inFlight = 0;
  // A reveal asked for before the editor has loaded.
  let pendingReveal: number | null = null;
  // Requests issued before this view existed are stale.
  let handledId = navigation.reveal?.id ?? 0;

  const content = $derived(app.document?.content ?? '');
  const path = $derived(app.document?.path ?? null);

  function sendEdit(text: string): void {
    inFlight++;
    void app.edit(text).finally(() => inFlight--);
  }

  async function diagram(source: string): Promise<string | null> {
    const scheme = effectiveScheme(app.preferences.theme, matchMedia(SYSTEM_DARK_QUERY).matches);
    const result = await drawDiagram(source, scheme);
    return result.ok ? result.svg : null;
  }

  function reveal(line: number): void {
    if (editor && scroller && revealBlockLine(scroller, editor.shownBlocks(), line)) {
      pendingReveal = null;
    }
  }

  const reportTopLine = throttle(() => {
    if (editor && scroller) navigation.reportTopLine(topBlockLine(scroller, editor.shownBlocks()));
  }, REPORT_INTERVAL_MS);

  $effect(() => {
    const root = host;
    if (!root) return;
    let disposed = false;
    let created: VisualEditor | null = null;
    import('../visual/milkdownEditor')
      .then(({ createVisualEditor }) =>
        createVisualEditor(root, {
          content: untrack(() => content),
          t: i18n.t,
          onEdit: sendEdit,
          drawDiagram: diagram,
        }),
      )
      .then((visual) => {
        if (disposed) return void visual.destroy();
        created = visual;
        editor = visual;
        visual.view.focus();
        if (pendingReveal !== null) reveal(pendingReveal);
      })
      .catch(() => {
        failed = true;
        notifier.error(i18n.t('visual.loadError'));
      });
    return () => {
      disposed = true;
      editor = null;
      void created?.destroy();
    };
  });

  $effect(() => {
    const text = content;
    if (editor && inFlight === 0 && text !== editor.source) editor.setSource(text);
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
</script>

<div
  class="scroller"
  bind:this={scroller}
  onscroll={reportTopLine}
  style:--doc-zoom={app.preferences.zoom}
>
  <div class="document">
    {#if !editor && !failed}
      <p class="loading" role="status">{i18n.t('visual.loading')}</p>
    {/if}
    {#key path}
      <div class="visual" bind:this={host}></div>
    {/key}
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

  .loading {
    color: var(--fg-muted);
    font: 13px var(--font-ui);
  }

  /* Crepe's colours, from the app tokens; its own reset and typography are left out so the
     document reads exactly as in the preview (document.css styles the editable root). */
  .visual :global(.milkdown) {
    --crepe-color-background: var(--bg);
    --crepe-color-on-background: var(--fg);
    --crepe-color-surface: var(--bg-elev);
    --crepe-color-surface-low: var(--doc-code-bg);
    --crepe-color-on-surface: var(--fg);
    --crepe-color-on-surface-variant: var(--fg-muted);
    --crepe-color-outline: var(--border);
    --crepe-color-primary: var(--accent);
    --crepe-color-secondary: var(--accent-soft);
    --crepe-color-on-secondary: var(--fg);
    --crepe-color-inverse: var(--fg);
    --crepe-color-on-inverse: var(--bg);
    --crepe-color-inline-code: var(--fg);
    --crepe-color-error: var(--danger);
    --crepe-color-hover: var(--bg-hover);
    --crepe-color-selected: var(--sel);
    --crepe-color-inline-area: var(--doc-inline-code-bg);
    --crepe-font-code: var(--font-code);
    --crepe-shadow-1: var(--shadow);
    --crepe-shadow-2: var(--shadow);
    position: relative;
  }

  .visual :global(.milkdown .ProseMirror) {
    outline: none;
    caret-color: var(--accent);
  }

  /* Crepe's virtual caret sits first in the editable root; the first block still loses its top
     margin, as in the preview. */
  .visual :global(.markdown-body > :nth-child(1 of :not(.prosemirror-virtual-cursor))) {
    margin-top: 0;
  }

  /* List items and table cells hold paragraphs here; they read tight, as in the preview. */
  .visual :global(.markdown-body :is(li, th, td) p) {
    margin: 0;
  }

  /* Maths and code read as in the preview: text colour, the document's code background and no
     line numbers. The block tools also appear for keyboard users. */
  .visual :global(.milkdown span[data-type='math_inline']) {
    padding: 0;
    color: inherit;
  }

  .visual :global(.milkdown .milkdown-code-block) {
    --crepe-color-surface: var(--doc-code-bg);
    border-radius: 8px;
  }

  .visual :global(.milkdown-code-block :is(.cm-gutters, .cm-activeLineGutter)) {
    display: none;
  }

  .visual :global(.milkdown-code-block .cm-activeLine) {
    background: transparent;
  }

  .visual
    :global(.milkdown-code-block:focus-within :is(.language-button, .tools-button-group > button)) {
    opacity: 1;
  }

  /* Crepe draws toolbar icons in its outline colour, which is a border tone here. */
  .visual :global(.milkdown .milkdown-toolbar .toolbar-item:not(.active) svg) {
    color: var(--fg-muted);
    fill: var(--fg-muted);
  }

  .visual :global(.milkdown .milkdown-icon) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .visual :global(.milkdown :is(button, input)) {
    border: none;
    background: none;
    box-shadow: none;
    color: inherit;
    font: inherit;
  }

  .visual :global(.milkdown :is(button, input):focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .visual
    :global(
      :is(
          .milkdown-slash-menu,
          .milkdown-toolbar,
          .milkdown-block-handle,
          .milkdown-link-preview,
          .milkdown-link-edit,
          .milkdown-latex-inline-edit,
          .milkdown-code-block .tools
        )
        *
    ) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
</style>
