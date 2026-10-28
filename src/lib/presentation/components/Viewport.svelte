<script lang="ts">
  import { app } from '../app.svelte';
  import CodeEditor from './CodeEditor.svelte';
  import PagedPreview from './PagedPreview.svelte';
  import Preview from './Preview.svelte';
  import SlidesView from './SlidesView.svelte';
  import SplitView from './SplitView.svelte';

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
  <SlidesView />
{:else if view === 'edit-preview'}
  <Preview /><!-- T33: editable preview -->
{:else if view === 'edit-code'}
  <CodeEditor />
{:else if view === 'edit-split'}
  <SplitView />
{/if}
