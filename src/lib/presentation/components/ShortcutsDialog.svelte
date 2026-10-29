<script lang="ts">
  import { app } from '../app.svelte';
  import { filterShortcutGroups, shortcutGroups } from '../commands/shortcutList';
  import { dialogs } from '../dialogs.svelte';
  import { i18n } from '../i18n/i18n.svelte';
  import Dialog from './Dialog.svelte';

  let query = $state('');
  const groups = $derived(
    filterShortcutGroups(shortcutGroups(app.commands.all(), app.platform, i18n.t), query),
  );
</script>

<Dialog title={i18n.t('menu.keyboardShortcuts')} onclose={dialogs.close}>
  <!-- svelte-ignore a11y_autofocus -->
  <input
    class="search"
    type="search"
    autofocus
    placeholder={i18n.t('shortcuts.search')}
    aria-label={i18n.t('shortcuts.search')}
    bind:value={query}
  />

  {#each groups as group (group.id)}
    <section>
      <h3>{group.label}</h3>
      <ul>
        {#each group.rows as row (row.id)}
          <li>
            <span>{row.label}</span>
            <kbd>{row.keys}</kbd>
          </li>
        {/each}
      </ul>
    </section>
  {:else}
    <p class="empty">{i18n.t('shortcuts.noResults')}</p>
  {/each}
</Dialog>

<style>
  .search {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 7px;
    background: var(--bg);
    color: var(--fg);
    font: inherit;
  }

  h3 {
    margin: 16px 0 4px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--fg-muted);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 5px 0;
    border-bottom: 1px solid var(--border);
  }

  kbd {
    padding: 1px 7px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--bg);
    font: 12px var(--font-ui);
    white-space: nowrap;
  }

  .empty {
    margin: 20px 0 0;
    text-align: center;
    color: var(--fg-muted);
  }
</style>
