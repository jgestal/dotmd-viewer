// Where things are in the editor, in the app's terms: lines are counted from zero for the
// navigation channel and from one for the caret shown in the status bar.
import type { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

export interface CaretPosition {
  readonly line: number;
  readonly column: number;
}

/** The caret as 1-based line and column. */
export function caretOf(state: EditorState): CaretPosition {
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  return { line: line.number, column: head - line.from + 1 };
}

/** Zero-based line at the top of the visible area. */
export function topLineOf(view: EditorView): number {
  const block = view.lineBlockAtHeight(view.scrollDOM.scrollTop);
  return view.state.doc.lineAt(block.from).number - 1;
}

/** Scrolls so the zero-based `line` is the first one visible (clamped to the document). */
export function scrollLineToTop(view: EditorView, line: number): void {
  const { doc } = view.state;
  const target = doc.line(Math.min(Math.max(line, 0), doc.lines - 1) + 1);
  view.dispatch({ effects: EditorView.scrollIntoView(target.from, { y: 'start' }) });
}
