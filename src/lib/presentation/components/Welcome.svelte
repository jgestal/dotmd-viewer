<script lang="ts">
  import { baseName } from '$lib/domain/paths';
  import { app } from '../app.svelte';
  import { i18n } from '../i18n/i18n.svelte';
</script>

<section class="welcome">
  <img src="/favicon.png" alt="" width="64" height="64" />
  <h2>{i18n.t('app.name')}</h2>
  <p class="hint">{i18n.t('welcome.hint')}</p>
  <div class="actions">
    <button class="btn primary" onclick={() => app.openWithDialog()}>{i18n.t('menu.open')}</button>
    <button class="btn" onclick={() => app.chooseFolder()}>{i18n.t('menu.openFolder')}</button>
    <button class="btn" onclick={() => app.newDocument()}>{i18n.t('menu.new')}</button>
  </div>

  {#if app.preferences.recents.length > 0}
    <h3>{i18n.t('menu.openRecent')}</h3>
    <ul class="recents">
      {#each app.preferences.recents as path (path)}
        <li>
          <button onclick={() => app.open(path)} title={path}>
            <span class="name">{baseName(path)}</span>
            <span class="path">{path}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    max-width: 520px;
    margin: 12vh auto 0;
    padding: 0 24px;
    text-align: center;
  }

  h2 {
    margin: 4px 0 0;
    font-size: 22px;
    font-weight: 600;
  }

  .hint {
    margin: 0 0 8px;
    color: var(--fg-muted);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  h3 {
    align-self: stretch;
    margin: 28px 0 4px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-align: left;
    color: var(--fg-muted);
  }

  .recents {
    align-self: stretch;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .recents button {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: 6px 10px;
    border: 0;
    border-radius: 6px;
    background: none;
    text-align: left;
  }

  .recents button:hover {
    background: var(--bg-hover);
  }

  .path {
    color: var(--fg-muted);
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
