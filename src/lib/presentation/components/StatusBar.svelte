<script lang="ts">
  import { computeStatistics } from '$lib/domain/statistics';
  import { app } from '../app.svelte';
  import { debounced } from '../debounced.svelte';
  import { i18n } from '../i18n/i18n.svelte';
  import { createStatusFormat } from '../statusFormat';

  // Typing updates the counts after a short pause; opening another document updates them at once.
  const STATS_DELAY_MS = 250;

  const stats = debounced(
    () => (app.document ? computeStatistics(app.document.content) : null),
    STATS_DELAY_MS,
    () => app.document?.path,
  );

  const format = $derived(createStatusFormat(i18n.locale, i18n.t));
</script>

{#if app.document && stats.current}
  {@const counts = stats.current}
  <div class="bar">
    <div class="group">
      <span>{format.words(counts.words)}</span>
      <span title={format.charactersNoSpaces(counts.charactersNoSpaces)}>
        {format.characters(counts.characters)}
      </span>
      <span>{format.lines(counts.lines)}</span>
      <span>{format.readingTime(counts.readingMinutes)}</span>
    </div>
    <div class="group end">
      {#if app.cursor}<span>{format.cursor(app.cursor)}</span>{/if}
      <span>{format.mode(app.editing, app.preferences.editMode)}</span>
      <span>{format.encoding(app.document.encoding, app.document.hasBom)}</span>
      <span>{format.lineEnding(app.document.lineEnding)}</span>
    </div>
  </div>
{/if}

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-width: 0;
    font-variant-numeric: tabular-nums;
  }

  .group {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }

  .end {
    margin-left: auto;
  }
</style>
