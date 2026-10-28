<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '$lib/presentation/app.svelte';
  import Shell from '$lib/presentation/components/Shell.svelte';
  import Welcome from '$lib/presentation/components/Welcome.svelte';
  import { i18n } from '$lib/presentation/i18n/i18n.svelte';

  onMount(() => {
    void app.start();
  });

  // Shortcuts the native menu does not handle itself (it owns Undo, Copy, Quit…).
  function onKeydown(event: KeyboardEvent): void {
    const command = app.commands.findByEvent(event, app.platform);
    if (!command) return;
    event.preventDefault();
    void app.commands.execute(command.id);
  }

  $effect(() => {
    const theme = app.preferences.theme;
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  });
</script>

<svelte:window onkeydown={onKeydown} />

<Shell>
  {#snippet explorer()}
    <p class="placeholder">{i18n.t('sidebar.explorer')}</p>
  {/snippet}
  {#snippet favourites()}
    <p class="placeholder">{i18n.t('sidebar.favourites')}</p>
  {/snippet}
  {#snippet outline()}
    <p class="placeholder">{i18n.t('sidebar.outline')}</p>
  {/snippet}
  {#snippet viewport()}
    {#if app.document}
      <pre class="placeholder-doc">{app.document.content}</pre>
    {:else if app.ready}
      <Welcome />
    {/if}
  {/snippet}
  {#snippet statusBar()}
    {#if app.document}<span>{app.document.encoding.toUpperCase()}</span>{/if}
  {/snippet}
</Shell>

<style>
  .placeholder {
    padding: 12px 16px;
    color: var(--fg-muted);
  }

  .placeholder-doc {
    margin: 0;
    padding: 24px 32px;
    font: 13px/1.6 var(--font-code);
    white-space: pre-wrap;
    user-select: text;
  }
</style>
