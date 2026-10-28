import { EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { caretOf } from './position';

const stateWith = (doc: string, cursor: number) =>
  EditorState.create({ doc, selection: EditorSelection.cursor(cursor) });

describe('caretOf', () => {
  it('starts at line 1, column 1', () => {
    expect(caretOf(stateWith('abc', 0))).toEqual({ line: 1, column: 1 });
  });

  it('counts columns from one within the line', () => {
    expect(caretOf(stateWith('abc\ndef', 6))).toEqual({ line: 2, column: 3 });
  });

  it('puts the end of a line after its last character', () => {
    expect(caretOf(stateWith('abc\ndef', 3))).toEqual({ line: 1, column: 4 });
  });

  it('works on an empty document and an empty last line', () => {
    expect(caretOf(stateWith('', 0))).toEqual({ line: 1, column: 1 });
    expect(caretOf(stateWith('a\n', 2))).toEqual({ line: 2, column: 1 });
  });
});
