<script lang="ts">
  import { tick } from 'svelte';
  import type { Theme } from '$lib/domain/theme';
  import { app } from '../app.svelte';
  import { i18n } from '../i18n/i18n.svelte';
  import { themeLabel, themeOptions } from '../settingsOptions';
  import Icon from './Icon.svelte';

  let open = $state(false);
  let root = $state<HTMLElement>();

  const items = (): HTMLButtonElement[] => [
    ...(root?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []),
  ];

  async function toggle(): Promise<void> {
    open = !open;
    if (!open) return;
    await tick();
    const checked = items().find((item) => item.getAttribute('aria-checked') === 'true');
    (checked ?? items()[0])?.focus();
  }

  function close(): void {
    open = false;
    root?.querySelector<HTMLElement>('.tb')?.focus();
  }

  function choose(theme: Theme): void {
    app.setTheme(theme);
    close();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    const target = {
      ArrowDown: list[(index + 1) % list.length],
      ArrowUp: list[(index - 1 + list.length) % list.length],
      Home: list[0],
      End: list[list.length - 1],
    }[event.key];
    if (!target) return;
    event.preventDefault();
    target.focus();
  }
</script>

<svelte:window
  onpointerdown={(event) => {
    if (open && !root?.contains(event.target as Node)) open = false;
  }}
  onblur={() => (open = false)}
/>

<div class="picker" bind:this={root} onkeydown={onKeydown} role="presentation">
  <button
    class="tb"
    aria-haspopup="menu"
    aria-expanded={open}
    title={i18n.t('theme.pick')}
    aria-label={i18n.t('theme.pick')}
    onclick={toggle}
  >
    <Icon name="theme" />
  </button>
  {#if open}
    <div class="menu" role="menu" aria-label={i18n.t('menu.theme')}>
      {#each themeOptions as option (option.value)}
        <button
          class="item"
          role="menuitemradio"
          aria-checked={app.preferences.theme === option.value}
          onclick={() => choose(option.value)}
        >
          <span class="mark" aria-hidden="true"
            >{app.preferences.theme === option.value ? '✓' : ''}</span
          >
          {i18n.t(themeLabel(option.value))}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .picker {
    position: relative;
  }

  .menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 200;
    display: flex;
    flex-direction: column;
    min-width: 160px;
    padding: 5px;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--bg-elev);
    box-shadow: var(--shadow);
  }

  .item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px 5px 6px;
    border: 0;
    border-radius: 5px;
    background: none;
    color: var(--fg);
    text-align: left;
  }

  .item:hover,
  .item:focus-visible {
    background: var(--accent);
    color: var(--accent-fg);
    outline: none;
  }

  .mark {
    width: 14px;
    text-align: center;
  }
</style>
