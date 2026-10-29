import { TextSelection } from '@milkdown/kit/prose/state';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTranslator } from '../i18n/translator';
import { createVisualEditor, type VisualEditor } from './milkdownEditor';

// Milkdown's code blocks watch their visibility; jsdom has no IntersectionObserver.
beforeAll(() => {
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
});

// Every construct is written the way Milkdown would NOT write it, so any re-serialisation shows.
const CONSTRUCTS = {
  'front matter': '---\ntitle: Welcome\ntags: [demo]\n---',
  'star bullets and emphasis': '* *one*\n* __two__',
  'task list': '- [x] done\n- [ ] to do',
  'lazy ordered list': '1. First\n1. Second',
  'aligned table': '| Feature  | Supported |\n| :------- | :-------: |\n| Footnotes[^1] | yes  |',
  footnote: '[^1]: Like this one.',
  'GitHub alert': '> [!NOTE]\n> Callouts work too.',
  'inline maths': 'Inline $e^{i\\pi} + 1 = 0$ here.',
  'display maths': '$$\n\\int_0^\\infty e^{-x^2}\\,dx\n$$',
  'one-line display maths': '$$x^2$$',
  'mermaid fence': '```mermaid\ngraph LR\n  A --> B\n```',
  'tilde fence': '~~~js\nlet a = 1;\n~~~',
  highlight: 'Some ==highlighted== text.',
  'escaped characters': 'Not \\*emphasis\\* and a\\_b.',
  'reference link': 'See [the site][ref].\n\n[ref]: https://example.com',
  'raw HTML': '<div align="center">html</div>',
  'star rule': '***',
} as const;

const EDITED = 'Edit me here.';
const DOCUMENT = [...Object.values(CONSTRUCTS), EDITED].join('\n\n') + '\n';

let editor: VisualEditor | null = null;
let edits: string[] = [];

async function open(content: string): Promise<VisualEditor> {
  const root = document.createElement('div');
  document.body.append(root);
  edits = [];
  editor = await createVisualEditor(root, {
    content,
    t: createTranslator('en'),
    onEdit: (next) => edits.push(next),
    drawDiagram: async () => null,
  });
  return editor;
}

afterEach(async () => {
  await editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

/** Document position right after the first occurrence of `text`. */
function positionAfter({ view }: VisualEditor, text: string): number {
  let found = -1;
  view.state.doc.descendants((node, pos) => {
    if (found !== -1 || !node.isText) return found === -1;
    const index = node.text!.indexOf(text);
    if (index !== -1) found = pos + index + text.length;
    return false;
  });
  if (found === -1) throw new Error(`"${text}" is not in the editor`);
  return found;
}

/** What typing looks like to the editor: a key press, then a transaction. */
function type(target: VisualEditor, text: string, after: string): void {
  target.view.dom.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
  const at = positionAfter(target, after);
  target.view.dispatch(target.view.state.tr.insertText(text, at));
}

describe('createVisualEditor', () => {
  it('sends nothing while the document is only looked at', async () => {
    const visual = await open(DOCUMENT);
    expect(visual.view.dom.textContent).toContain('Callouts work too.');
    expect(visual.view.dom.classList.contains('markdown-body')).toBe(true);
    expect(edits).toEqual([]);
    expect(visual.source).toBe(DOCUMENT);
  });

  it('keeps the front matter out of the editor', async () => {
    const visual = await open(DOCUMENT);
    expect(visual.view.dom.textContent).not.toContain('tags:');
  });

  it('takes changes made before any user interaction as its own, not as edits', async () => {
    const visual = await open(DOCUMENT);
    visual.view.dispatch(visual.view.state.tr.insertText('!', positionAfter(visual, 'Edit me')));
    expect(edits).toEqual([]);
  });

  describe('an edit elsewhere leaves every other construct byte for byte', () => {
    it('changes only the edited paragraph', async () => {
      type(await open(DOCUMENT), ' More', 'Edit me here.');
      expect(edits).toEqual([DOCUMENT.replace(EDITED, `${EDITED} More`)]);
    });

    it.each(Object.entries(CONSTRUCTS))('%s survives', async (_name, construct) => {
      type(await open(DOCUMENT), ' More', 'Edit me here.');
      expect(edits.at(-1)).toContain(construct);
    });
  });

  describe('the edited block is written in Milkdown style', () => {
    it('keeps an alert marker and display maths readable', async () => {
      const content = '> [!NOTE]\n> Callouts.\n\n$$\nx^2\n$$\n';
      const visual = await open(content);
      type(visual, ' Yes.', 'Callouts.');
      expect(edits.at(-1)).toBe('> [!NOTE]\n> Callouts. Yes.\n\n$$\nx^2\n$$\n');
    });

    it('re-pads an edited table', async () => {
      const content = 'Intro.\n\n| a | b |\n|:-|-:|\n| one | 2 |\n';
      type(await open(content), 'x', 'one');
      expect(edits.at(-1)).toBe('Intro.\n\n| a    |  b |\n| :--- | -: |\n| onex |  2 |\n');
    });

    it('writes bullets with a dash', async () => {
      type(await open('* a\n* b\n'), 'c', 'b');
      expect(edits.at(-1)).toBe('- a\n- bc\n');
    });
  });

  it('removes a deleted block with its separator', async () => {
    const visual = await open('First.\n\nSecond.\n\nThird.\n');
    visual.view.dom.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    const { doc } = visual.view.state;
    const second = doc.child(0).nodeSize;
    visual.view.dispatch(visual.view.state.tr.delete(second, second + doc.child(1).nodeSize));
    expect(edits.at(-1)).toBe('First.\n\nThird.\n');
  });

  it('keeps CRLF line endings', async () => {
    type(await open('* a\r\n\r\nPara.\r\n'), '!', 'Para.');
    expect(edits.at(-1)).toBe('* a\r\n\r\nPara.!\r\n');
  });

  it('shows a change from outside without echoing it and keeps the caret on its text', async () => {
    const visual = await open('First.\n\nSecond.\n');
    const caret = positionAfter(visual, 'Sec');
    visual.view.dispatch(
      visual.view.state.tr.setSelection(TextSelection.create(visual.view.state.doc, caret)),
    );
    visual.setSource('First, longer.\n\nSecond.\n');
    expect(visual.view.dom.textContent).toContain('First, longer.');
    expect(visual.source).toBe('First, longer.\n\nSecond.\n');
    expect(visual.view.state.selection.head).toBe(positionAfter(visual, 'Sec'));
    expect(edits).toEqual([]);
  });

  it('splices later edits into the text the outside change brought', async () => {
    const visual = await open('A.\n');
    visual.setSource('---\nk: v\n---\n* a\n\nB.\n');
    type(visual, '!', 'B.');
    expect(edits.at(-1)).toBe('---\nk: v\n---\n* a\n\nB.!\n');
  });

  it('maps each block on screen to its source line, front matter included', async () => {
    const visual = await open('---\nk: v\n---\n# Title\n\nText\non two lines.\n\n## Next\n');
    expect(visual.shownBlocks().map((block) => block.start)).toEqual([4, 6, 9]);
    expect(visual.shownBlocks()[2].element.tagName).toBe('H2');
  });
});
