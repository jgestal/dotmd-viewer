<script lang="ts">
  import { activeHeadingIndex, extractOutline } from '$lib/domain/outline';
  import { app } from '../app.svelte';
  import { i18n } from '../i18n/i18n.svelte';
  import { navigation } from '../navigation.svelte';

  const INDENT_PX = 12;

  const outline = $derived(extractOutline(app.document?.content ?? ''));
  const activeIndex = $derived(activeHeadingIndex(outline, navigation.topLine));
  // Indent relative to the shallowest heading, so a document starting at ## is not shifted.
  const topLevel = $derived(Math.min(...outline.map((heading) => heading.level)));

  let list: HTMLElement | undefined = $state();

  // Keep the active heading visible when the document scrolls past the panel's height.
  $effect(() => {
    void activeIndex;
    list?.querySelector('[aria-current="location"]')?.scrollIntoView({ block: 'nearest' });
  });
</script>

{#if !app.document}
  <p class="empty">{i18n.t('outline.noDocument')}</p>
{:else if outline.length === 0}
  <p class="empty">{i18n.t('outline.noHeadings')}</p>
{:else}
  <nav aria-label={i18n.t('sidebar.outline')} bind:this={list}>
    <ul>
      {#each outline as heading, index (heading.line)}
        <li>
          <button
            class="item"
            class:active={index === activeIndex}
            style:padding-left="{12 + (heading.level - topLevel) * INDENT_PX}px"
            aria-current={index === activeIndex ? 'location' : undefined}
            onclick={() => navigation.revealLine(heading.line)}
          >
            {heading.text}
          </button>
        </li>
      {/each}
    </ul>
  </nav>
{/if}

<style>
  .empty {
    padding: 12px 16px;
    color: var(--fg-muted);
  }

  nav {
    padding: 4px 6px 12px;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .item {
    display: block;
    width: 100%;
    padding-block: 4px;
    padding-right: 10px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--fg-muted);
    font: inherit;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
  }

  .item:hover {
    background: var(--bg-hover);
    color: var(--fg);
  }

  .item.active {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
  }

  .item:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
</style>
