<script lang="ts">
  import { tick } from 'svelte';
  import { closeFallbackMenu, fallbackMenuState } from '../contextMenu/fallbackMenu.svelte';

  const EDGE_GAP = 8;

  const menu = $derived(fallbackMenuState.open);
  let element = $state<HTMLElement>();
  let position = $state({ x: 0, y: 0 });

  function buttons(): HTMLButtonElement[] {
    return [...(element?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
  }

  // Place the menu at the pointer, pulled back inside the window, and focus its first item.
  $effect(() => {
    if (!menu || !element) return;
    const { offsetWidth, offsetHeight } = element;
    position = {
      x: Math.max(EDGE_GAP, Math.min(menu.at.x, window.innerWidth - offsetWidth - EDGE_GAP)),
      y: Math.max(EDGE_GAP, Math.min(menu.at.y, window.innerHeight - offsetHeight - EDGE_GAP)),
    };
    const menuElement = element;
    const previousFocus = document.activeElement;
    void tick().then(() => buttons()[0]?.focus());
    return () => {
      // Give focus back unless the chosen action already moved it elsewhere (e.g. a rename field).
      const focus = document.activeElement;
      const stranded = focus === document.body || menuElement.contains(focus);
      if (stranded && previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  });

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
      if (event.key === 'Escape') closeFallbackMenu(null);
      return;
    }
    const items = buttons();
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const target = {
      ArrowDown: items[(index + 1) % items.length],
      ArrowUp: items[(index - 1 + items.length) % items.length],
      Home: items[0],
      End: items[items.length - 1],
    }[event.key];
    if (!target) return;
    event.preventDefault();
    target.focus();
  }
</script>

<svelte:window onblur={() => closeFallbackMenu(null)} onresize={() => closeFallbackMenu(null)} />

{#if menu}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="backdrop"
    onpointerdown={() => closeFallbackMenu(null)}
    oncontextmenu={(event) => {
      event.preventDefault();
      closeFallbackMenu(null);
    }}
  ></div>
  <div
    class="menu"
    role="menu"
    tabindex="-1"
    bind:this={element}
    style:left="{position.x}px"
    style:top="{position.y}px"
    onkeydown={onKeydown}
  >
    {#each menu.items as item (item.id)}
      {#if item.separatorBefore}<div class="separator" role="separator"></div>{/if}
      <button
        class="item"
        role="menuitem"
        disabled={item.enabled === false}
        onclick={() => closeFallbackMenu(item.id)}
      >
        {item.label}
      </button>
    {/each}
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 300;
  }

  .menu {
    position: fixed;
    z-index: 301;
    display: flex;
    flex-direction: column;
    min-width: 200px;
    padding: 5px;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--bg-elev);
    box-shadow: var(--shadow);
    font-size: 13px;
  }

  .item {
    padding: 5px 10px;
    border: 0;
    border-radius: 5px;
    background: none;
    color: var(--fg);
    text-align: left;
  }

  .item:hover:not(:disabled),
  .item:focus-visible {
    background: var(--accent);
    color: #fff;
    outline: none;
  }

  .item:disabled {
    color: var(--fg-muted);
    opacity: 0.6;
  }

  .separator {
    height: 1px;
    margin: 4px 6px;
    background: var(--border);
  }
</style>
