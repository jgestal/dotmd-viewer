<script lang="ts">
  import { app } from '../app.svelte';
  import { classifyDrop } from '../drop/classifyDrop';
  import { i18n } from '../i18n/i18n.svelte';
  import Icon from './Icon.svelte';

  const KEYS = {
    file: 'drop.open',
    folder: 'drop.openFolder',
    rejected: 'drop.rejected',
  } as const;

  const kind = $derived(app.draggedPaths === null ? null : classifyDrop(app.draggedPaths));
</script>

{#if kind !== null}
  <div class="overlay" class:rejected={kind === 'rejected'} role="status" aria-live="polite">
    <div class="card">
      <Icon name={kind === 'folder' ? 'folder' : kind === 'file' ? 'upload' : 'close'} size={36} />
      <span>{i18n.t(KEYS[kind])}</span>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 150;
    display: grid;
    place-items: center;
    /* The window's own drop handling must not see the pointer, only the native layer does. */
    pointer-events: none;
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    backdrop-filter: blur(2px);
    outline: 3px dashed var(--accent);
    outline-offset: -12px;
    color: var(--accent);
  }

  .overlay.rejected {
    background: color-mix(in srgb, var(--danger) 14%, transparent);
    outline-color: var(--danger);
    color: var(--danger);
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 24px 36px;
    border: 1px solid currentColor;
    border-radius: 14px;
    background: var(--bg-elev);
    box-shadow: var(--shadow);
    font-size: 15px;
    font-weight: 600;
  }
</style>
