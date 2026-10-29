<script lang="ts">
  import { dialogs } from '../dialogs.svelte';
  import AboutDialog from './AboutDialog.svelte';
  import SettingsDialog from './SettingsDialog.svelte';
  import ShortcutsDialog from './ShortcutsDialog.svelte';
</script>

{#if dialogs.current === 'settings'}
  <SettingsDialog />
{:else if dialogs.current === 'shortcuts'}
  <ShortcutsDialog />
{:else if dialogs.current === 'about'}
  <AboutDialog />
{/if}
