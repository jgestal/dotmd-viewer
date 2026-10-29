<script lang="ts">
  import { displayName, isDirty } from '$lib/domain/document';
  import { app } from '../app.svelte';
  import { i18n } from '../i18n/i18n.svelte';

  // macOS only: the window uses an overlay title bar (tauri.macos.conf.json), so the traffic
  // lights float over this strip and the app draws the title itself, in the theme's colours.
  // The native title is drawn dark over a dark page on macOS 26.
  const title = $derived(
    app.document ? displayName(app.document, i18n.t('document.untitled')) : i18n.t('app.name'),
  );
  const edited = $derived(app.document !== null && isDirty(app.document));
</script>

<div class="titlebar" data-tauri-drag-region>
  <span class="title" data-tauri-drag-region>
    {title}{#if edited}<span class="edited" data-tauri-drag-region>
        — {i18n.t('titlebar.edited')}</span
      >{/if}
  </span>
</div>

<style>
  .titlebar {
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--titlebar-height);
    /* Room for the traffic lights on the left. */
    padding: 0 80px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-sidebar);
  }

  .title {
    overflow: hidden;
    color: var(--fg);
    font-size: 13px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .edited {
    color: var(--fg-muted);
    font-weight: 400;
  }
</style>
