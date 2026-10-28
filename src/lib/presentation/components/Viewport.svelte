<script lang="ts">
  import { app } from '../app.svelte';
  import CodeEditor from './CodeEditor.svelte';
  import PagedPreview from './PagedPreview.svelte';
  import Preview from './Preview.svelte';

  // What the main area shows for the open document. Reading follows the chosen layout;
  // editing follows the chosen mode. Each view is its own component, so this file only routes.
  const view = $derived(
    app.editing ? `edit-${app.preferences.editMode}` : `read-${app.preferences.layout}`,
  );
</script>

{#if view === 'read-continuous'}
  <Preview />
{:else if view === 'read-pages'}
  <PagedPreview />
{:else if view === 'read-slides'}
  <Preview /><!-- T35: slides -->
{:else if view === 'edit-preview'}
  <Preview /><!-- T33: editable preview -->
{:else if view === 'edit-code'}
  <CodeEditor />
{:else if view === 'edit-split'}
  <Preview /><!-- T32: code editor and preview side by side -->
{/if}
