import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { insertTextAt } from './insertText';

let view: EditorView;

const editor = (doc: string, caret: number): EditorView => {
  view = new EditorView({
    state: EditorState.create({ doc, selection: EditorSelection.cursor(caret) }),
    parent: document.body,
  });
  return view;
};

afterEach(() => view.destroy());

describe('insertTextAt', () => {
  it('inserts where the pointer is over the text and leaves the caret after it', () => {
    const target = editor('one\ntwo', 0);
    vi.spyOn(target, 'posAtCoords').mockReturnValue(4);
    insertTextAt(target, { x: 10, y: 20 }, '![a](assets/a.png)');
    expect(target.state.doc.toString()).toBe('one\n![a](assets/a.png)two');
    expect(target.state.selection.main.head).toBe(4 + '![a](assets/a.png)'.length);
  });

  it('asks the editor about the pointer position it was given', () => {
    const target = editor('x', 0);
    const posAtCoords = vi.spyOn(target, 'posAtCoords').mockReturnValue(1);
    insertTextAt(target, { x: 10, y: 20 }, 'y');
    expect(posAtCoords).toHaveBeenCalledWith({ x: 10, y: 20 });
  });

  it('inserts at the caret when the pointer is not over the text', () => {
    const target = editor('abcd', 2);
    vi.spyOn(target, 'posAtCoords').mockReturnValue(null);
    insertTextAt(target, { x: 10, y: 20 }, 'X');
    expect(target.state.doc.toString()).toBe('abXcd');
  });

  it('inserts at the caret when there is no pointer position', () => {
    const target = editor('abcd', 4);
    insertTextAt(target, null, 'X');
    expect(target.state.doc.toString()).toBe('abcdX');
    expect(target.state.selection.main.head).toBe(5);
  });

  it('inserts at the start of the document when the pointer is on it', () => {
    const target = editor('abcd', 3);
    vi.spyOn(target, 'posAtCoords').mockReturnValue(0);
    insertTextAt(target, { x: 0, y: 0 }, 'X');
    expect(target.state.doc.toString()).toBe('Xabcd');
  });
});
