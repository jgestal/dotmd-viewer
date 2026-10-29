// The selection commands the context menu of the code editor needs.
import { EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

/** The selected text; several selections are joined by line breaks, as the clipboard does. */
export function selectedText(view: EditorView): string {
  return view.state.selection.ranges
    .filter((range) => !range.empty)
    .map((range) => view.state.sliceDoc(range.from, range.to))
    .join('\n');
}

/** Replaces every selection with `text` (deleting them when it is empty) and focuses the editor. */
export function replaceSelection(view: EditorView, text: string): void {
  view.dispatch({
    ...view.state.replaceSelection(text),
    scrollIntoView: true,
    userEvent: text === '' ? 'delete.cut' : 'input.paste',
  });
  view.focus();
}

export function selectAll(view: EditorView): void {
  view.dispatch({ selection: EditorSelection.single(0, view.state.doc.length) });
  view.focus();
}
