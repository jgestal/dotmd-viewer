<script lang="ts">
  import { untrack } from 'svelte';
  import { openSearchPanel } from '@codemirror/search';
  import { EditorState, Transaction } from '@codemirror/state';
  import { EditorView, type ViewUpdate } from '@codemirror/view';
  import { app } from '../app.svelte';
  import { activeEditor } from '../editor/activeEditor.svelte';
  import { changeBetween } from '../editor/changes';
  import { editorExtensions, editorTexts, textsSlot } from '../editor/extensions';
  import { insertTextAt } from '../editor/insertText';
  import { caretOf, scrollLineToTop, topLineOf } from '../editor/position';
  import { i18n } from '../i18n/i18n.svelte';
  import { throttle } from '../navigation';
  import { navigation } from '../navigation.svelte';

  // The Markdown source of the open document. The document is the source of truth: typing is sent
  // to the app, and only a text that differs from the editor's (a reload from disk) is written
  // back. The editor lives as long as this component; opening another document swaps its state,
  // which starts a fresh undo history.
  const REPORT_INTERVAL_MS = 100;

  // Embedding: the split view reads the editor and hears its scrolls.
  let { editorView = $bindable(), onScroll }: { editorView?: EditorView; onScroll?: () => void } =
    $props();

  let host = $state<HTMLElement>();
  let view: EditorView | undefined;
  let shownPath: string | null = null;
  // Edits sent to the app that it has not stored yet: until they settle, its text is stale.
  let inFlight = 0;
  // Requests issued before this view existed are stale.
  let handledId = navigation.reveal?.id ?? 0;

  const content = $derived(app.document?.content ?? '');
  const path = $derived(app.document?.path ?? null);

  function sendEdit(text: string): void {
    inFlight++;
    void app.edit(text).finally(() => inFlight--);
  }

  function onUpdate(update: ViewUpdate): void {
    const fromOutside = update.transactions.some((tr) => tr.annotation(Transaction.remote));
    if (update.docChanged && !fromOutside) sendEdit(update.state.doc.toString());
    if (update.docChanged || update.selectionSet) app.cursor = caretOf(update.state);
  }

  const createState = (text: string): EditorState =>
    EditorState.create({ doc: text, extensions: editorExtensions(i18n.t, onUpdate) });

  const reportTopLine = throttle(() => {
    if (view) navigation.reportTopLine(topLineOf(view));
  }, REPORT_INTERVAL_MS);

  function openSearch(focusReplace: boolean): void {
    if (!view) return;
    openSearchPanel(view);
    if (focusReplace) view.dom.querySelector<HTMLInputElement>('input[name="replace"]')?.focus();
  }

  $effect(() => {
    if (!host) return;
    const editor = new EditorView({
      state: untrack(() => createState(content)),
      parent: host,
    });
    view = editor;
    editorView = editor;
    shownPath = untrack(() => path);
    app.cursor = caretOf(editor.state);
    editor.scrollDOM.addEventListener(
      'scroll',
      () => {
        reportTopLine();
        onScroll?.();
      },
      { passive: true },
    );
    const unregister = activeEditor.register({
      find: () => openSearch(false),
      replace: () => openSearch(true),
      insertAt: (point, text) => view && insertTextAt(view, point, text),
    });
    editor.focus();
    return () => {
      unregister();
      editor.destroy();
      view = undefined;
      editorView = undefined;
      app.cursor = null;
    };
  });

  $effect(() => {
    const text = content;
    const key = path;
    if (!view) return;
    if (key !== shownPath) {
      shownPath = key;
      const state = untrack(() => createState(text));
      view.setState(state);
      app.cursor = caretOf(state);
      return;
    }
    if (inFlight > 0) return;
    const change = changeBetween(view.state.doc.toString(), text);
    if (change) view.dispatch({ changes: change, annotations: Transaction.remote.of(true) });
  });

  $effect(() => {
    const t = i18n.t;
    view?.dispatch({ effects: textsSlot.reconfigure(editorTexts(t)) });
  });

  $effect(() => {
    const request = navigation.reveal;
    if (!request || request.id === handledId) return;
    handledId = request.id;
    if (view) scrollLineToTop(view, request.line);
  });
</script>

<div class="editor" bind:this={host} style:--editor-zoom={app.preferences.zoom}></div>

<style>
  .editor {
    height: 100%;
    overflow: hidden;
  }
</style>
