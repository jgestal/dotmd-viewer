import type { EditorView } from '@codemirror/view';

/** A point in the window, in CSS pixels. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Inserts `text` where `point` is over the editor, or at the caret when there is no point or it is
 * not over the text; the caret ends up after the insertion and the editor takes focus.
 */
export function insertTextAt(view: EditorView, point: Point | null, text: string): void {
  const at = (point && view.posAtCoords(point)) ?? view.state.selection.main.head;
  view.dispatch({
    changes: { from: at, insert: text },
    selection: { anchor: at + text.length },
    scrollIntoView: true,
    userEvent: 'input.drop',
  });
  view.focus();
}
