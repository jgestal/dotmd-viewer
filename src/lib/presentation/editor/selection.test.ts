import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { replaceSelection, selectAll, selectedText } from './selection';

let view: EditorView;

const editor = (doc: string, selection: EditorSelection): EditorView => {
  view = new EditorView({
    state: EditorState.create({
      doc,
      selection,
      extensions: EditorState.allowMultipleSelections.of(true),
    }),
    parent: document.body,
  });
  return view;
};

afterEach(() => view.destroy());

describe('selectedText', () => {
  it('is empty when only a caret is placed', () => {
    expect(selectedText(editor('hello', EditorSelection.single(2)))).toBe('');
  });

  it('answers the selected range', () => {
    expect(selectedText(editor('hello world', EditorSelection.single(6, 11)))).toBe('world');
  });

  it('joins several selections with a line break and skips bare carets', () => {
    const selection = EditorSelection.create([
      EditorSelection.range(0, 1),
      EditorSelection.cursor(2),
      EditorSelection.range(3, 5),
    ]);
    expect(selectedText(editor('abcdef', selection))).toBe('a\nde');
  });
});

describe('replaceSelection', () => {
  it('swaps the selection for the text and puts the caret after it', () => {
    const target = editor('hello world', EditorSelection.single(6, 11));
    replaceSelection(target, 'there');
    expect(target.state.doc.toString()).toBe('hello there');
    expect(target.state.selection.main.head).toBe(11);
  });

  it('deletes the selection when the text is empty', () => {
    const target = editor('hello world', EditorSelection.single(5, 11));
    replaceSelection(target, '');
    expect(target.state.doc.toString()).toBe('hello');
  });

  it('inserts at the caret when nothing is selected', () => {
    const target = editor('ab', EditorSelection.single(1));
    replaceSelection(target, 'X');
    expect(target.state.doc.toString()).toBe('aXb');
  });
});

describe('selectAll', () => {
  it('selects the whole document', () => {
    const target = editor('one\ntwo', EditorSelection.single(0));
    selectAll(target);
    expect(target.state.selection.main.from).toBe(0);
    expect(target.state.selection.main.to).toBe(7);
  });
});
