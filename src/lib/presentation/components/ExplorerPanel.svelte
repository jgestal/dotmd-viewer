<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { baseName } from '$lib/domain/paths';
  import { app } from '../app.svelte';
  import { renameEntry, showEntryMenu, trashEntry } from '../contextMenu/entryActions';
  import { explorer } from '../explorer/explorer.svelte';
  import {
    firstChildPath,
    firstPath,
    lastPath,
    nextPath,
    parentPath,
    previousPath,
    visibleRows,
    type TreeRow,
  } from '../explorer/tree';
  import { highlightedFolder } from '../explorer/dragMove';
  import { rowShortcut, type RowShortcut } from '../explorer/rowKeys';
  import { sidebarDrag } from '../explorer/sidebarDrag';
  import { i18n } from '../i18n/i18n.svelte';
  import Icon from './Icon.svelte';
  import RenameInput from './RenameInput.svelte';

  const GUIDE_WIDTH = 14;

  const root = $derived(app.preferences.lastFolder);
  const activePath = $derived(app.document?.path ?? null);
  const rows = $derived(root === null ? [] : visibleRows(explorer.tree, root));
  const listedEmpty = $derived(root !== null && explorer.tree.children.get(root)?.length === 0);

  const dropFolder = $derived(highlightedFolder(sidebarDrag.current));
  const draggedPath = $derived(sidebarDrag.current?.source.path ?? null);

  let focused = $state<string | null>(null);
  /** Path of the row whose name is being edited. */
  let renaming = $state<string | null>(null);
  const elements: Record<string, HTMLElement | null> = {};

  // Roving tabindex: one row is in the tab order, the focused one or else the open document.
  const tabStop = $derived.by(() => {
    const has = (path: string | null) => rows.some((row) => row.entry.path === path);
    if (has(focused)) return focused;
    return has(activePath) ? activePath : firstPath(rows);
  });

  $effect(() => {
    explorer.setRoot(root);
    explorer.loadMissing();
  });

  $effect(() => {
    if (root !== null && activePath !== null) untrack(() => explorer.reveal(activePath));
  });

  async function moveTo(path: string | null): Promise<void> {
    if (path === null) return;
    focused = path;
    await tick();
    elements[path]?.focus();
  }

  function activate(row: TreeRow): void {
    focused = row.entry.path;
    if (row.entry.kind === 'file') void app.open(row.entry.path);
    else if (row.expandable) explorer.toggle(row.entry.path);
  }

  function onRight(row: TreeRow): void {
    if (row.expandable && !row.expanded) explorer.expand(row.entry.path);
    else void moveTo(firstChildPath(rows, row.entry.path));
  }

  function onLeft(row: TreeRow): void {
    if (row.expanded) explorer.collapse(row.entry.path);
    else void moveTo(parentPath(rows, row.entry.path));
  }

  function startRename(row: TreeRow): void {
    focused = row.entry.path;
    renaming = row.entry.path;
  }

  /** Ends the rename: `newName` is applied unless it is null (cancelled) or unchanged. */
  async function finishRename(row: TreeRow, newName: string | null): Promise<void> {
    const { path, name, kind } = row.entry;
    if (renaming !== path) return;
    renaming = null;
    const renamed =
      newName === null || newName === name ? null : await renameEntry(path, newName, kind);
    await moveTo(renamed ?? path);
  }

  function openMenu(row: TreeRow, at: { x: number; y: number }): void {
    focused = row.entry.path;
    const { path, kind } = row.entry;
    void showEntryMenu({ path, kind }, at, () => startRename(row));
  }

  function openMenuBelow(row: TreeRow): void {
    const box = elements[row.entry.path]?.getBoundingClientRect();
    openMenu(row, { x: (box?.left ?? 0) + 24, y: box?.bottom ?? 0 });
  }

  async function trash(row: TreeRow): Promise<void> {
    const { path } = row.entry;
    const neighbour = previousPath(rows, path) ?? nextPath(rows, path);
    if (await trashEntry(path)) await moveTo(neighbour);
  }

  function onShortcut(shortcut: RowShortcut, row: TreeRow): void {
    const actions: Record<RowShortcut, () => unknown> = {
      menu: () => openMenuBelow(row),
      rename: () => startRename(row),
      trash: () => trash(row),
    };
    void actions[shortcut]();
  }

  function startDrag(event: PointerEvent, row: TreeRow): void {
    const { path, kind } = row.entry;
    if (renaming === path) return;
    sidebarDrag.press(event, { kind: 'entry', path, entryKind: kind });
  }

  function onKeydown(event: KeyboardEvent, row: TreeRow): void {
    const shortcut = rowShortcut(event, app.platform);
    if (shortcut) {
      event.preventDefault();
      onShortcut(shortcut, row);
      return;
    }
    const path = row.entry.path;
    const actions: Record<string, () => void> = {
      ArrowDown: () => void moveTo(nextPath(rows, path)),
      ArrowUp: () => void moveTo(previousPath(rows, path)),
      ArrowRight: () => onRight(row),
      ArrowLeft: () => onLeft(row),
      Home: () => void moveTo(firstPath(rows)),
      End: () => void moveTo(lastPath(rows)),
      Enter: () => activate(row),
      ' ': () => activate(row),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }
</script>

{#if root === null}
  <div class="empty">
    <p>{i18n.t('explorer.empty')}</p>
    <button class="btn primary" onclick={() => app.chooseFolder()}>
      {i18n.t('menu.openFolder')}
    </button>
  </div>
{:else}
  <div class="header" class:drop-target={dropFolder === root} data-drop="root" data-path={root}>
    <span class="folder-name" title={root}>{baseName(root) || root}</span>
    <button
      class="tb"
      title={i18n.t('explorer.chooseFolder')}
      aria-label={i18n.t('explorer.chooseFolder')}
      onclick={() => app.chooseFolder()}
    >
      <Icon name="folder" />
    </button>
  </div>
  {#if listedEmpty}
    <p class="note">{i18n.t('explorer.emptyFolder')}</p>
  {/if}
  <ul class="tree" role="tree" aria-label={i18n.t('explorer.tree')}>
    {#each rows as row (row.entry.path)}
      {@const path = row.entry.path}
      <li
        class="row"
        class:active={path === activePath}
        class:drop-target={dropFolder === path}
        class:dragged={draggedPath === path}
        data-drop="row"
        data-path={path}
        data-kind={row.entry.kind}
        role="treeitem"
        aria-level={row.level}
        aria-expanded={row.expandable ? row.expanded : undefined}
        aria-selected={path === activePath}
        tabindex={path === tabStop ? 0 : -1}
        title={path}
        bind:this={elements[path]}
        onclick={() => activate(row)}
        onpointerdown={(event) => startDrag(event, row)}
        oncontextmenu={(event) => {
          event.preventDefault();
          openMenu(row, { x: event.clientX, y: event.clientY });
        }}
        onkeydown={(event) => onKeydown(event, row)}
        onfocus={() => (focused = path)}
      >
        {#each [...Array(row.level - 1).keys()] as depth (depth)}
          <span class="guide" style:left="{depth * GUIDE_WIDTH + 9}px"></span>
        {/each}
        <span class="indent" style:width="{(row.level - 1) * GUIDE_WIDTH}px"></span>
        <span class="chevron" class:open={row.expanded}>
          {#if row.expandable}<Icon name="chevron" size={14} />{/if}
        </span>
        <Icon name={row.entry.kind === 'folder' ? 'folder' : 'file'} size={15} />
        {#if renaming === path}
          <RenameInput
            name={row.entry.name}
            kind={row.entry.kind}
            oncommit={(newName) => finishRename(row, newName)}
            oncancel={() => finishRename(row, null)}
          />
        {:else}
          <span class="name">{row.entry.name}</span>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    padding: 2px 8px 2px 14px;
    border-radius: 6px;
  }

  .folder-name {
    min-width: 0;
    overflow: hidden;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--fg-muted);
  }

  .tree {
    margin: 0;
    padding: 2px 6px 12px;
    list-style: none;
  }

  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 5px;
    height: 26px;
    padding: 0 8px 0 2px;
    border-radius: 6px;
    color: var(--fg);
    white-space: nowrap;
  }

  .row:hover {
    background: var(--bg-hover);
  }

  .row.dragged {
    opacity: 0.45;
  }

  .row.drop-target,
  .header.drop-target {
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }

  .row.active {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .row:focus-visible {
    outline-offset: -2px;
  }

  .guide {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: color-mix(in srgb, var(--fg) 16%, transparent);
  }

  .indent {
    flex-shrink: 0;
  }

  .chevron {
    display: inline-flex;
    flex-shrink: 0;
    width: 14px;
    color: var(--fg-muted);
    transition: transform 0.12s;
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .row :global(svg) {
    flex-shrink: 0;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 32px 16px;
    text-align: center;
    color: var(--fg-muted);
  }

  .empty p,
  .note {
    margin: 0;
  }

  .note {
    padding: 8px 16px;
    color: var(--fg-muted);
  }
</style>
