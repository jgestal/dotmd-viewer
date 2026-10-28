<script lang="ts">
  import { onMount } from 'svelte';
  import type { EntryKind } from '$lib/ports';
  import { i18n } from '../i18n/i18n.svelte';
  import { renameSelectionEnd } from '../explorer/renameSelection';

  // The name of a tree row turned into a field: Enter commits, Esc cancels, leaving it commits.
  let {
    name,
    kind,
    oncommit,
    oncancel,
  }: {
    name: string;
    kind: EntryKind;
    oncommit: (newName: string) => void;
    oncancel: () => void;
  } = $props();

  let input = $state<HTMLInputElement>();
  // The field starts from the name it was opened with; later changes of the prop do not matter.
  // svelte-ignore state_referenced_locally
  let value = $state(name);

  onMount(() => {
    input?.focus();
    input?.setSelectionRange(0, renameSelectionEnd(name, kind));
  });

  function onKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Enter') oncommit(value);
    else if (event.key === 'Escape') oncancel();
  }
</script>

<input
  class="rename"
  bind:this={input}
  bind:value
  aria-label={i18n.t('entryMenu.renameField', { name })}
  spellcheck="false"
  autocomplete="off"
  onkeydown={onKeydown}
  onclick={(event) => event.stopPropagation()}
  onblur={() => oncommit(value)}
/>

<style>
  .rename {
    flex: 1;
    min-width: 0;
    height: 22px;
    padding: 0 4px;
    border: 1px solid var(--accent);
    border-radius: 4px;
    background: var(--bg);
    color: var(--fg);
    font: inherit;
  }

  .rename:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--accent-soft);
  }
</style>
