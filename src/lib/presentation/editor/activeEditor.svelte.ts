// What the app commands can ask of the code editor that is on screen. Purely local UI state: the
// editor registers itself while mounted, and Find / Replace are disabled while none is. Its
// presence also tells that the code is on screen, which is where dropped images are inserted.
import type { Point } from './insertText';

export interface EditorActions {
  find(): void;
  replace(): void;
  /** Inserts text where the point is over the editor, or at the caret without a point. */
  insertAt(point: Point | null, text: string): void;
}

let current = $state.raw<EditorActions | null>(null);

export const activeEditor = {
  get current(): EditorActions | null {
    return current;
  },
  /** Makes `actions` the target of Find / Replace; the returned function withdraws it. */
  register(actions: EditorActions): () => void {
    current = actions;
    return () => {
      if (current === actions) current = null;
    };
  },
};
