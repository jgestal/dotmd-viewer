// CodeMirror ships English texts for its search panel; EditorState.phrases swaps them for ours.
import type { Translate } from '$lib/ports';

const PHRASE_KEYS: Readonly<Record<string, string>> = {
  Find: 'editor.search.find',
  Replace: 'editor.search.replace',
  next: 'editor.search.next',
  previous: 'editor.search.previous',
  all: 'editor.search.all',
  'match case': 'editor.search.matchCase',
  regexp: 'editor.search.regexp',
  'by word': 'editor.search.byWord',
  replace: 'editor.search.replaceOne',
  'replace all': 'editor.search.replaceAll',
  close: 'editor.search.close',
  'current match': 'editor.search.currentMatch',
  'on line': 'editor.search.onLine',
  'replaced $ matches': 'editor.search.replacedMatches',
  'replaced match on $': 'editor.search.replacedMatch',
  'Go to line': 'editor.goToLine',
  go: 'editor.go',
};

/** CodeMirror phrase → translated text. */
export function editorPhrases(t: Translate): Record<string, string> {
  return Object.fromEntries(Object.entries(PHRASE_KEYS).map(([phrase, key]) => [phrase, t(key)]));
}
