import type { Translate } from '$lib/ports';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { bracketMatching } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { search, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  highlightActiveLine,
  keymap,
  placeholder,
  type ViewUpdate,
} from '@codemirror/view';
import { editorPhrases } from './phrases';
import { editorTheme } from './theme';

const PAIRED_CHARACTERS = ['*', '_', '`', '[', '('];

/** Holds everything the user reads, so a language change can swap it without a new editor. */
export const textsSlot = new Compartment();

export const editorTexts = (t: Translate): Extension => [
  EditorState.phrases.of(editorPhrases(t)),
  placeholder(t('editor.placeholder')),
  EditorView.contentAttributes.of({ 'aria-label': t('editor.label') }),
];

/** Find is bound by the app (Mod+F), so the editor's own binding is left out. */
const searchBindings = searchKeymap.filter((binding) => binding.key !== 'Mod-f');

export function editorExtensions(t: Translate, onUpdate: (update: ViewUpdate) => void): Extension {
  return [
    // Code blocks load their language the first time one is seen (language-data is lazy).
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    markdownLanguage.data.of({ closeBrackets: { brackets: PAIRED_CHARACTERS } }),
    history(),
    search({ top: true }),
    closeBrackets(),
    bracketMatching(),
    highlightActiveLine(),
    EditorView.lineWrapping,
    // No Tab binding on purpose: Tab keeps moving focus out of the editor.
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchBindings, ...historyKeymap]),
    textsSlot.of(editorTexts(t)),
    editorTheme,
    EditorView.updateListener.of(onUpdate),
  ];
}
