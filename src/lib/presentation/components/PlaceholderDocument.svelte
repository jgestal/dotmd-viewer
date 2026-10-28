<script lang="ts">
  import { untrack } from 'svelte';
  import { app } from '../app.svelte';
  import { lineAtOffset, offsetOfLine, throttle } from '../navigation';
  import { navigation } from '../navigation.svelte';

  // PLACEHOLDER implementation of the viewport (T29 replaces this component with the preview).
  // It shows the raw source and honours the navigation channel approximately, by line height.
  const LINE_HEIGHT = 13 * 1.6;
  const REPORT_INTERVAL_MS = 100;

  let source: HTMLPreElement | undefined = $state();

  // The scrolling element is the viewport that wraps this component.
  const scroller = (): HTMLElement | null => source?.parentElement ?? null;

  const report = throttle(
    (scrollTop: number) => navigation.reportTopLine(lineAtOffset(scrollTop, LINE_HEIGHT)),
    REPORT_INTERVAL_MS,
  );

  $effect(() => {
    const element = scroller();
    if (!element) return;
    const onScroll = (): void => report(element.scrollTop);
    element.addEventListener('scroll', onScroll, { passive: true });
    return () => element.removeEventListener('scroll', onScroll);
  });

  // Requests issued before this view existed are stale.
  let handledId = navigation.reveal?.id ?? 0;

  $effect(() => {
    const request = navigation.reveal;
    if (!request || request.id === handledId) return;
    handledId = request.id;
    untrack(() => {
      const element = scroller();
      if (element) element.scrollTop = offsetOfLine(request.line, LINE_HEIGHT);
    });
  });
</script>

<pre bind:this={source} class="placeholder-doc">{app.document?.content}</pre>

<style>
  /* No wrapping, so one source line is exactly one line box. */
  .placeholder-doc {
    margin: 0;
    padding: 0 32px;
    min-height: 100%;
    box-sizing: border-box;
    font: 13px/1.6 var(--font-code);
    white-space: pre;
    user-select: text;
  }
</style>
