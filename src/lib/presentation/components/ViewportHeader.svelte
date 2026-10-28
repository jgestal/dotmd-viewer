<script lang="ts">
  import { displayName } from '$lib/domain/document';
  import { app, type EditMode, type Layout } from '../app.svelte';
  import { i18n } from '../i18n/i18n.svelte';
  import Icon from './Icon.svelte';

  const modes: readonly EditMode[] = ['preview', 'code', 'split'];
  const layouts: readonly Layout[] = ['continuous', 'pages', 'slides'];

  const title = $derived(
    app.document ? displayName(app.document, i18n.t('document.untitled')) : i18n.t('app.name'),
  );
</script>

<header class="header">
  <button
    class="tb"
    aria-pressed={app.preferences.sidebarVisible}
    title={i18n.t('menu.showSidebar')}
    onclick={() => app.toggleSidebar()}
  >
    <Icon name="sidebar" />
  </button>

  <h1 class="title" title={app.document?.path ?? ''}>
    {title}
    {#if app.dirty}<span class="dirty" aria-label={i18n.t('document.unsaved')}>●</span>{/if}
  </h1>

  {#if app.document}
    {@const path = app.document.path}
    {#if path}
      {@const starred = app.isFavourite(path)}
      <button
        class="tb star"
        aria-pressed={starred}
        title={i18n.t(starred ? 'favourites.remove' : 'favourites.add')}
        aria-label={i18n.t(starred ? 'favourites.remove' : 'favourites.add')}
        onclick={() => app.toggleFavourite(path, 'file')}
      >
        <Icon name="star" filled={starred} />
      </button>
    {/if}
    {#if app.editing}
      <div class="segmented" role="radiogroup" aria-label={i18n.t('menu.view')}>
        {#each modes as mode (mode)}
          <button
            role="radio"
            aria-checked={app.preferences.editMode === mode}
            onclick={() => app.setEditMode(mode)}>{i18n.t(`mode.${mode}`)}</button
          >
        {/each}
      </div>
    {:else}
      <div class="segmented" role="radiogroup" aria-label={i18n.t('menu.view')}>
        {#each layouts as layout (layout)}
          <button
            role="radio"
            aria-checked={app.preferences.layout === layout}
            onclick={() => app.setLayout(layout)}>{i18n.t(`layout.${layout}`)}</button
          >
        {/each}
      </div>
    {/if}

    <button class="tb edit" aria-pressed={app.editing} onclick={() => app.toggleEditing()}>
      <Icon name={app.editing ? 'eye' : 'pencil'} />
      {i18n.t(app.editing ? 'action.stopEditing' : 'action.edit')}
    </button>
  {/if}
</header>

<style>
  .header {
    display: flex;
    align-items: center;
    gap: 10px;
    height: var(--header-height);
    padding: 0 10px;
    border-bottom: 1px solid var(--border);
  }

  .title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dirty {
    margin-left: 6px;
    color: var(--accent);
    font-size: 10px;
    vertical-align: middle;
  }

  .star[aria-pressed='true'] {
    background: none;
    color: var(--accent);
  }

  .edit[aria-pressed='true'] {
    background: var(--accent-soft);
    color: var(--accent);
  }
</style>
