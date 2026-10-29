<script lang="ts">
  import { baseName } from '$lib/domain/paths';
  import { sidebarDrag } from '../explorer/sidebarDrag';
  import Icon from './Icon.svelte';

  const OFFSET = 14;
  const drag = $derived(sidebarDrag.current);
</script>

{#if drag}
  <div
    class="ghost"
    class:inert={drag.target === null}
    style:transform="translate({drag.point.x + OFFSET}px, {drag.point.y + OFFSET}px)"
    aria-hidden="true"
  >
    <Icon name={drag.source.entryKind === 'folder' ? 'folder' : 'file'} size={14} />
    <span>{baseName(drag.source.path)}</span>
  </div>
{/if}

<style>
  .ghost {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 240px;
    padding: 4px 10px;
    border: 1px solid var(--accent);
    border-radius: 6px;
    background: var(--bg-elev);
    box-shadow: var(--shadow);
    color: var(--fg);
    font-size: 12px;
    pointer-events: none;
    white-space: nowrap;
  }

  .ghost span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Over a place where dropping does nothing. */
  .ghost.inert {
    border-color: var(--border);
    color: var(--fg-muted);
  }
</style>
