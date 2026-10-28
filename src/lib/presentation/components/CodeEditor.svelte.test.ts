import { EditorView } from '@codemirror/view';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDocument } from '$lib/domain/document';
import { app } from '../app.svelte';
import { activeEditor } from '../editor/activeEditor.svelte';
import CodeEditor from './CodeEditor.svelte';

const open = (path: string | null, raw: string) => ({
  doc: openDocument({ path, raw, encoding: 'utf-8', hasBom: false }),
});

describe('CodeEditor', () => {
  let component: ReturnType<typeof mount> | null;

  beforeEach(() => {
    app.documentState = open('/notes/a.md', '# Title\n\nbody\n');
    app.edit = vi.fn(async () => {});
    component = mount(CodeEditor, { target: document.body });
    flushSync();
  });

  afterEach(() => {
    if (component) unmount(component);
    document.body.innerHTML = '';
  });

  const content = () => document.querySelector<HTMLElement>('.cm-content')!;

  it('shows the document and reports the caret', () => {
    expect(content().textContent).toContain('# Title');
    expect(app.cursor).toEqual({ line: 1, column: 1 });
  });

  it('sends typing to the app and follows the caret', () => {
    const view = EditorView.findFromDOM(document.body)!;
    view.dispatch({ changes: { from: 0, insert: 'x' }, selection: { anchor: 3 } });
    expect(app.edit).toHaveBeenCalledWith('x# Title\n\nbody\n');
    expect(app.cursor).toEqual({ line: 1, column: 4 });
  });

  it('writes a document changed from outside into the editor without echoing it back', () => {
    app.documentState = open('/notes/a.md', '# Title\n\nbody changed\n');
    flushSync();
    expect(content().textContent).toContain('body changed');
    expect(app.edit).not.toHaveBeenCalled();
  });

  it('swaps the text when another document opens', () => {
    app.documentState = open('/notes/b.md', 'other file');
    flushSync();
    expect(content().textContent).toBe('other file');
  });

  it('opens the search panel with translated texts', () => {
    activeEditor.current!.find();
    expect(document.querySelector('.cm-search')).not.toBeNull();
  });

  it('registers for Find and Replace while mounted and clears the caret on destroy', () => {
    expect(activeEditor.current).not.toBeNull();
    unmount(component!);
    component = null;
    expect(activeEditor.current).toBeNull();
    expect(app.cursor).toBeNull();
  });
});
