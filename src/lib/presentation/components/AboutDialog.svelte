<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '../app.svelte';
  import { dialogs } from '../dialogs.svelte';
  import { i18n } from '../i18n/i18n.svelte';
  import { AUTHOR_EMAIL, AUTHOR_NAME, AUTHOR_WEBSITE, REPOSITORY } from '../credits';
  import Dialog from './Dialog.svelte';

  let version = $state('');

  onMount(async () => {
    version = await app.container.appInfo.version();
  });

  // Links go through the system's browser and mail client, never the app's own webview.
  const open = (event: MouseEvent, url: string): void => {
    event.preventDefault();
    void app.openExternal(url);
  };
</script>

{#snippet link(url: string, text: string)}
  <!-- External address, handed to the system: not an in-app route. -->
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
  <a href={url} onclick={(event) => open(event, url)}>{text}</a>
{/snippet}

<Dialog title={i18n.t('menu.about')} onclose={dialogs.close}>
  <div class="about">
    <img src="/favicon.png" alt="" width="96" height="96" />
    <h3>{i18n.t('app.name')}</h3>
    <p class="muted">{i18n.t('about.version', { version })}</p>
    <section class="credits" aria-label={i18n.t('about.credits')}>
      <h4>{i18n.t('about.credits')}</h4>
      <p class="muted">{i18n.t('about.madeBy')}</p>
      <p class="author">{AUTHOR_NAME}</p>
      <p>{@render link(`mailto:${AUTHOR_EMAIL}`, AUTHOR_EMAIL)}</p>
      <p>{@render link(AUTHOR_WEBSITE, AUTHOR_WEBSITE.replace(/^https?:\/\//, ''))}</p>
    </section>
    <p class="muted">{i18n.t('about.licence')}</p>
    <p>{@render link(REPOSITORY, i18n.t('about.source'))}</p>
  </div>
</Dialog>

<style>
  .about {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  h3 {
    margin: 12px 0 0;
    font-size: 20px;
    font-weight: 600;
  }

  p {
    margin: 8px 0 0;
  }

  .credits {
    margin-top: 16px;
    padding: 12px 24px;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }

  .credits p {
    margin-top: 4px;
  }

  h4 {
    margin: 0 0 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--fg-muted);
  }

  .author {
    font-size: 15px;
    font-weight: 600;
  }

  .muted {
    color: var(--fg-muted);
  }

  a {
    color: var(--accent);
  }
</style>
