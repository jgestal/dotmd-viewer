<script lang="ts">
  import { tick } from 'svelte';
  import { isSamePath } from '$lib/domain/paths';
  import { app } from '../app.svelte';
  import { showEntryMenu } from '../contextMenu/entryActions';
  import { favouriteLabel, reorderTarget } from '../favouriteLabel';
  import { rowShortcut } from '../explorer/rowKeys';
  import { sidebarDrag } from '../explorer/sidebarDrag';
  import { i18n } from '../i18n/i18n.svelte';
  import Icon from './Icon.svelte';

  let list = $state<HTMLUListElement>();

  const target = $derived(sidebarDrag.current?.target ?? null);
  const draggedIndex = $derived(
    sidebarDrag.current?.source.kind === 'favourite' ? sidebarDrag.current.source.index : null,
  );

  // Re-check the disk whenever the list changes; `refreshFavourites` drops stale answers.
  $effect(() => {
    void app.preferences.favourites;
    void app.refreshFavourites();
  });

  type Favourite = (typeof app.favourites)[number];

  function activate(fav: Favourite): void {
    if (fav.missing) return;
    if (fav.kind === 'folder') void app.openFolder(fav.path);
    else void app.open(fav.path);
  }

  function openMenu(fav: Favourite, at: { x: number; y: number }): void {
    void showEntryMenu({ path: fav.path, kind: fav.kind, missing: fav.missing }, at);
  }

  function startDrag(event: PointerEvent, fav: Favourite, index: number): void {
    sidebarDrag.press(event, { kind: 'favourite', index, path: fav.path, entryKind: fav.kind });
  }

  async function onKeydown(event: KeyboardEvent, fav: Favourite, index: number): Promise<void> {
    if (rowShortcut(event, app.platform) === 'menu') {
      event.preventDefault();
      const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
      openMenu(fav, { x: box.left + 24, y: box.bottom });
      return;
    }
    if (!event.altKey) return;
    const target = reorderTarget(event.key, index);
    if (target === null) return;
    event.preventDefault();
    app.moveFavourite(index, target);
    await tick();
    list?.querySelectorAll<HTMLElement>('.open')[Math.max(0, target)]?.focus();
  }
</script>

{#if app.favourites.length === 0}
  <div class="empty" class:drop-target={target?.action === 'favourite'} data-drop="favourites">
    <Icon name="star" size={28} />
    <p class="title">{i18n.t('favourites.empty.title')}</p>
    <p class="hint">{i18n.t('favourites.empty.hint')}</p>
  </div>
{:else}
  <ul
    class="list"
    class:drop-target={target?.action === 'favourite'}
    data-drop="favourites"
    bind:this={list}
    aria-label={i18n.t('favourites.list')}
  >
    {#each app.favourites as fav, index (fav.path)}
      {@const label = favouriteLabel(fav.path)}
      <li
        class="item"
        class:missing={fav.missing}
        class:drop-target={target?.action === 'reorder' && target.to === index}
        class:dragged={draggedIndex === index}
        data-drop="favourite"
        data-index={index}
        class:current={app.document?.path != null && isSamePath(app.document.path, fav.path)}
      >
        <button
          class="open"
          aria-disabled={fav.missing}
          aria-current={app.document?.path != null && isSamePath(app.document.path, fav.path)}
          aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
          title={fav.missing
            ? `${i18n.t('favourites.missing')}\n${fav.path}`
            : `${fav.path}\n${i18n.t('favourites.reorderHint')}`}
          onclick={() => activate(fav)}
          onpointerdown={(event) => startDrag(event, fav, index)}
          oncontextmenu={(event) => {
            event.preventDefault();
            openMenu(fav, { x: event.clientX, y: event.clientY });
          }}
          onkeydown={(event) => onKeydown(event, fav, index)}
        >
          <Icon name={fav.kind === 'folder' ? 'folder' : 'file'} />
          <span class="name">{label.name}</span>
          <span class="parent">{label.parent}</span>
        </button>
        <button
          class="tb remove"
          aria-label={i18n.t('favourites.removeItem', { name: label.name })}
          title={i18n.t('favourites.remove')}
          onclick={() => app.removeFavourite(fav.path)}
        >
          <Icon name="close" size={14} />
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .list {
    margin: 0;
    padding: 4px 6px;
    list-style: none;
  }

  .item {
    display: flex;
    align-items: center;
    border-radius: 6px;
  }

  .item.dragged {
    opacity: 0.45;
  }

  .item.drop-target {
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }

  .list.drop-target {
    background: var(--accent-soft);
    border-radius: 6px;
  }

  .item:hover {
    background: var(--bg-hover);
  }

  .item.current {
    background: var(--bg-active);
  }

  .open {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 0;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--fg);
    text-align: left;
  }

  .item.current .open {
    color: var(--accent);
  }

  .item.missing .open {
    opacity: 0.45;
    text-decoration: line-through;
    cursor: not-allowed;
  }

  .name {
    flex-shrink: 0;
    max-width: 70%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .parent {
    min-width: 0;
    overflow: hidden;
    color: var(--fg-muted);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove {
    opacity: 0;
  }

  .item:hover .remove,
  .item:focus-within .remove {
    opacity: 1;
  }

  .empty.drop-target {
    background: var(--accent-soft);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 32px 20px;
    color: var(--fg-muted);
    text-align: center;
  }

  .empty p {
    margin: 0;
  }

  .title {
    color: var(--fg);
    font-weight: 600;
  }

  .hint {
    font-size: 12px;
    line-height: 1.5;
  }
</style>
