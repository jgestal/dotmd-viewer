<script lang="ts">
  import type { Snippet } from 'svelte';
  import { app, type SidebarTab } from '../app.svelte';
  import { i18n } from '../i18n/i18n.svelte';
  import Icon, { type IconName } from './Icon.svelte';

  // Each tab's panel is passed in by the shell, so the sidebar only knows about switching.
  let {
    explorer,
    favourites,
    outline,
  }: { explorer: Snippet; favourites: Snippet; outline: Snippet } = $props();

  const tabs: readonly { id: SidebarTab; icon: IconName }[] = [
    { id: 'explorer', icon: 'folder' },
    { id: 'favourites', icon: 'star' },
    { id: 'outline', icon: 'list' },
  ];

  const panels = $derived({ explorer, favourites, outline });
  const active = $derived(app.preferences.sidebarTab);
</script>

<aside class="sidebar" aria-label={i18n.t(`sidebar.${active}`)}>
  <div class="tabs" role="tablist">
    {#each tabs as tab (tab.id)}
      <button
        class="tb"
        role="tab"
        id="sidebar-tab-{tab.id}"
        aria-controls="sidebar-panel"
        aria-selected={active === tab.id}
        title={i18n.t(`sidebar.${tab.id}`)}
        onclick={() => app.showSidebarTab(tab.id)}
      >
        <Icon name={tab.icon} />
        <span class="label">{i18n.t(`sidebar.${tab.id}`)}</span>
      </button>
    {/each}
  </div>
  <div class="panel" id="sidebar-panel" role="tabpanel" aria-labelledby="sidebar-tab-{active}">
    {@render panels[active]()}
  </div>
</aside>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100%;
    background: var(--bg-sidebar);
    border-right: 1px solid var(--border);
  }

  .tabs {
    display: flex;
    gap: 2px;
    padding: 8px 8px 6px;
    height: var(--header-height);
    align-items: center;
  }

  /* Only the active tab spells out its name; the others are icons with a tooltip. */
  .tabs .tb[aria-selected='true'] {
    flex: 1;
    min-width: 0;
  }

  .tabs .tb[aria-selected='false'] .label {
    display: none;
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .panel {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
</style>
