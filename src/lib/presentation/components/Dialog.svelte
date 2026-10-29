<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { i18n } from '../i18n/i18n.svelte';
  import Icon from './Icon.svelte';

  let { title, onclose, children }: { title: string; onclose: () => void; children: Snippet } =
    $props();

  let dialog: HTMLDialogElement;
  const titleId = $props.id();

  // showModal makes everything else inert (the focus trap) and Esc fires `close`; focus goes
  // back to whatever had it before the dialog opened.
  onMount(() => {
    const opener = document.activeElement;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (opener instanceof HTMLElement) opener.focus();
    };
  });

  // The backdrop is part of the <dialog> element: a click on it lands on the element itself.
  const onBackdropClick = (event: MouseEvent): void => {
    if (event.target === dialog) onclose();
  };
</script>

<dialog bind:this={dialog} aria-labelledby={titleId} {onclose} onclick={onBackdropClick}>
  <header>
    <h2 id={titleId}>{title}</h2>
    <button
      class="tb"
      title={i18n.t('action.close')}
      aria-label={i18n.t('action.close')}
      onclick={onclose}
    >
      <Icon name="close" size={14} />
    </button>
  </header>
  <div class="body">
    {@render children()}
  </div>
</dialog>

<style>
  dialog {
    width: min(520px, calc(100vw - 32px));
    max-height: min(640px, calc(100vh - 48px));
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg-elev);
    color: var(--fg);
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  dialog[open] {
    display: flex;
    flex-direction: column;
  }

  dialog::backdrop {
    background: rgba(10, 14, 16, 0.4);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 12px 20px;
    border-bottom: 1px solid var(--border);
  }

  h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  .body {
    padding: 16px 20px 20px;
    overflow-y: auto;
    user-select: text;
  }
</style>
