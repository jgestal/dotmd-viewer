<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '$lib/presentation/app.svelte';
  import OutlinePanel from '$lib/presentation/components/OutlinePanel.svelte';
  import ExplorerPanel from '$lib/presentation/components/ExplorerPanel.svelte';
  import DialogHost from '$lib/presentation/components/DialogHost.svelte';
  import FavouritesPanel from '$lib/presentation/components/FavouritesPanel.svelte';
  import Shell from '$lib/presentation/components/Shell.svelte';
  import StatusBar from '$lib/presentation/components/StatusBar.svelte';
  import Viewport from '$lib/presentation/components/Viewport.svelte';
  import Welcome from '$lib/presentation/components/Welcome.svelte';
  import { i18n } from '$lib/presentation/i18n/i18n.svelte';
  import { createMenuInstaller, currentMenu } from '$lib/presentation/menu/nativeMenu';

  onMount(() => {
    void app.start();
  });

  // Shortcuts the native menu does not handle itself (it owns Undo, Copy, Quit…).
  function onKeydown(event: KeyboardEvent): void {
    const command = app.commands.findByEvent(event, app.platform);
    if (!command) return;
    event.preventDefault();
    app.runCommand(command.id);
  }

  // The native menu bar follows the language, the recents and every command's state.
  let installMenu: ReturnType<typeof createMenuInstaller> | undefined;
  $effect(() => {
    if (!app.ready) return;
    installMenu ??= createMenuInstaller(app.container.menu, {
      onCommand: (id) => app.runCommand(id),
      onRecent: (path) => void app.open(path),
    });
    const tree = currentMenu({
      platform: app.platform,
      t: i18n.t,
      recents: app.preferences.recents,
      commands: app.commands,
    });
    void installMenu(tree);
  });

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
      <Viewport />
    {:else if app.ready}
      <Welcome />
    {/if}
  {/snippet}
  {#snippet statusBar()}
    <StatusBar />
  {/snippet}
</Shell>
<DialogHost />
