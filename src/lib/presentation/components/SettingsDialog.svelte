<script lang="ts">
  import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '$lib/domain/preferences';
  import { app } from '../app.svelte';
  import { dialogs } from '../dialogs.svelte';
  import { i18n } from '../i18n/i18n.svelte';
  import { languageOptions, pageSizeOptions, themeOptions, zoomLabel } from '../settingsOptions';
  import Dialog from './Dialog.svelte';

  const groups = [
    { key: 'language', label: 'settings.language', options: languageOptions },
    { key: 'theme', label: 'settings.theme', options: themeOptions },
    { key: 'pageSize', label: 'settings.pageSize', options: pageSizeOptions },
  ] as const;
</script>

<Dialog title={i18n.t('settings.title')} onclose={dialogs.close}>
  <div class="settings">
    {#each groups as { key, label, options } (key)}
      <div class="row">
        <span class="name" id="setting-{key}">{i18n.t(label)}</span>
        <div class="segmented" role="radiogroup" aria-labelledby="setting-{key}">
          {#each options as option (option.value)}
            <button
              role="radio"
              aria-checked={app.preferences[key] === option.value}
              onclick={() => app.setPreference(key, option.value)}
            >
              {i18n.t(option.label)}
            </button>
          {/each}
        </div>
      </div>
    {/each}

    <div class="row">
      <label class="name" for="setting-zoom">{i18n.t('settings.zoom')}</label>
      <div class="zoom">
        <input
          id="setting-zoom"
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={ZOOM_STEP}
          value={app.preferences.zoom}
          aria-valuetext={zoomLabel(app.preferences.zoom)}
          oninput={(event) => app.setPreference('zoom', event.currentTarget.valueAsNumber)}
        />
        <output for="setting-zoom">{zoomLabel(app.preferences.zoom)}</output>
        <button class="btn" onclick={() => app.resetZoom()}>{i18n.t('settings.zoomReset')}</button>
      </div>
    </div>
  </div>
</Dialog>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .name {
    font-weight: 500;
  }

  .zoom {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  input[type='range'] {
    width: 140px;
    accent-color: var(--accent);
  }

  output {
    min-width: 40px;
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: var(--fg-muted);
  }

  .btn {
    padding: 3px 10px;
  }
</style>
