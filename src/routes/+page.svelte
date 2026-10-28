<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '$lib/presentation/app.svelte';
  import OutlinePanel from '$lib/presentation/components/OutlinePanel.svelte';
  import PlaceholderDocument from '$lib/presentation/components/PlaceholderDocument.svelte';
  import ExplorerPanel from '$lib/presentation/components/ExplorerPanel.svelte';
  import FavouritesPanel from '$lib/presentation/components/FavouritesPanel.svelte';
  import Shell from '$lib/presentation/components/Shell.svelte';
  import StatusBar from '$lib/presentation/components/StatusBar.svelte';
  import Welcome from '$lib/presentation/components/Welcome.svelte';

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
    <ExplorerPanel />
  {/snippet}
  {#snippet favourites()}
    <FavouritesPanel />
  {/snippet}
  {#snippet outline()}
    <OutlinePanel />
  {/snippet}
  {#snippet viewport()}
    {#if app.document}
      <PlaceholderDocument />
    {:else if app.ready}
      <Welcome />
    {/if}
  {/snippet}
  {#snippet statusBar()}
    <StatusBar />
  {/snippet}
</Shell>
