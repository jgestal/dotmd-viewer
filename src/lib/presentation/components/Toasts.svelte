<script lang="ts">
  import { i18n } from '../i18n/i18n.svelte';
  import { toastStore } from '../toasts.svelte';
  import Icon from './Icon.svelte';
</script>

<div class="toasts" aria-live="polite">
  {#each toastStore.items as toast (toast.id)}
    <div class="toast {toast.kind}" role={toast.kind === 'error' ? 'alert' : 'status'}>
      <span>{toast.message}</span>
      <button
        class="tb"
        title={i18n.t('action.dismiss')}
        onclick={() => toastStore.dismiss(toast.id)}
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    right: 16px;
    bottom: calc(var(--status-height) + 12px);
    z-index: 200;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: min(420px, calc(100vw - 32px));
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 8px 8px 14px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-elev);
    box-shadow: var(--shadow);
    user-select: text;
  }

  .toast span {
    flex: 1;
  }

  .toast.error {
    border-color: color-mix(in srgb, var(--danger) 50%, var(--border));
  }

  .toast.error span::before {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 8px;
    border-radius: 50%;
    background: var(--danger);
  }
</style>
