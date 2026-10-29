<script lang="ts" module>
  import { DEFAULT_RATIO } from '../split/splitRatio';

  // The divider position is remembered while the app runs, across mode switches and documents.
  let rememberedRatio = $state(DEFAULT_RATIO);
</script>

<script lang="ts">
  import type { EditorView } from '@codemirror/view';
  import { i18n } from '../i18n/i18n.svelte';
  import { followEditor, followPreview } from '../split/paneSync';
  import { isEcho } from '../split/scrollSync';
  import { clampRatio, KEYBOARD_STEP_PX } from '../split/splitRatio';
  import CodeEditor from './CodeEditor.svelte';
  import Preview from './Preview.svelte';

  // The code on one side and its preview on the other, scrolling together. Whichever pane the
  // user last pointed at, wheeled or focused leads; the other follows. The follower's own scroll
  // events are ignored, and so are those fired just after the app moved a pane itself.
  type Pane = 'code' | 'preview';
  const STACK_BELOW_PX = 900;
  const SEPARATOR_PX = 6;

  let container = $state<HTMLElement>();
  let width = $state(0);
  let height = $state(0);
  let editorView = $state<EditorView>();
  let previewScroller = $state<HTMLElement>();
  let stacked = $state(false);

  let leader: Pane = 'code';
  const movedAt: Record<Pane, number> = { code: -Infinity, preview: -Infinity };

  const size = $derived(stacked ? height : width);
  const ratio = $derived(clampRatio(rememberedRatio, size));
  const tracks = $derived(
    `minmax(0, ${ratio * 1000}fr) ${SEPARATOR_PX}px minmax(0, ${(1 - ratio) * 1000}fr)`,
  );

  const lead = (pane: Pane) => () => (leader = pane);

  function onScroll(source: Pane): void {
    if (source !== leader || isEcho(performance.now(), movedAt[source]) || !editorView) return;
    if (!previewScroller) return;
    const follower: Pane = source === 'code' ? 'preview' : 'code';
    movedAt[follower] = performance.now();
    if (source === 'code') followEditor(editorView, previewScroller);
    else followPreview(editorView, previewScroller);
  }

  function startResize(): void {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    document.body.classList.add('resizing');
    const move = (e: PointerEvent) => {
      const position = stacked ? e.clientY - rect.top : e.clientX - rect.left;
      rememberedRatio = clampRatio(position / size, size);
    };
    const stop = () => {
      document.body.classList.remove('resizing');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  function resizeWithKeys(event: KeyboardEvent): void {
    const keys: Record<string, number> = stacked
      ? { ArrowUp: -KEYBOARD_STEP_PX, ArrowDown: KEYBOARD_STEP_PX }
      : { ArrowLeft: -KEYBOARD_STEP_PX, ArrowRight: KEYBOARD_STEP_PX };
    const delta = keys[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    rememberedRatio = clampRatio(ratio + delta / size, size);
  }

  $effect(() => {
    const query = matchMedia(`(max-width: ${STACK_BELOW_PX - 1}px)`);
    const follow = () => (stacked = query.matches);
    follow();
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  });
</script>

<div
  class="split"
  class:stacked
  bind:this={container}
  bind:clientWidth={width}
  bind:clientHeight={height}
  style:--tracks={tracks}
>
  <!-- Pointing, wheeling or focusing a pane only decides who leads; the panes handle the rest. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="pane"
    onpointerenter={lead('code')}
    onpointerdown={lead('code')}
    onwheel={lead('code')}
    onfocusin={lead('code')}
  >
    <CodeEditor bind:editorView onScroll={() => onScroll('code')} />
  </div>
  <!-- A focusable separator is the ARIA window-splitter pattern, so it takes keys and pointer. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="divider"
    role="separator"
    aria-orientation={stacked ? 'horizontal' : 'vertical'}
    aria-label={i18n.t('split.resize')}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(ratio * 100)}
    tabindex="0"
    onpointerdown={startResize}
    onkeydown={resizeWithKeys}
  ></div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="pane"
    onpointerenter={lead('preview')}
    onpointerdown={lead('preview')}
    onwheel={lead('preview')}
    onfocusin={lead('preview')}
  >
    <Preview
      bind:scroller={previewScroller}
      reportsTopLine={false}
      onScroll={() => onScroll('preview')}
    />
  </div>
</div>

<style>
  .split {
    display: grid;
    grid-template-columns: var(--tracks);
    grid-template-rows: minmax(0, 1fr);
    height: 100%;
  }

  .split.stacked {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: var(--tracks);
  }

  .pane {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .divider {
    position: relative;
    cursor: col-resize;
    outline-offset: -2px;
  }

  /* A hairline in the middle of a wider grab area. */
  .divider::after {
    content: '';
    position: absolute;
    inset: 0 2px;
    background: var(--border);
  }

  .stacked .divider {
    cursor: row-resize;
  }

  .stacked .divider::after {
    inset: 2px 0;
  }

  .divider:hover::after,
  .divider:focus-visible::after {
    background: var(--accent);
  }
</style>
