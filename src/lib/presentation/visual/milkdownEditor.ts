// The visual (WYSIWYG) editor: Milkdown's Crepe over the document body. Loaded on demand, so
// nothing here reaches the main bundle.
//
// Round trip: the editor never re-serialises the whole document. It remembers which source
// block each of its top-level blocks came from, and after a user edit it serialises only the
// blocks that changed and splices them into the original text (see sourceBlocks.ts). Opening a
// document and not touching it sends nothing; changes made before the user has interacted
// (Milkdown settling its own attributes) are absorbed into the baseline.
import { languages } from '@codemirror/language-data';
import { Crepe, CrepeFeature } from '@milkdown/crepe';
import '@milkdown/crepe/theme/common/prosemirror.css';
import '@milkdown/crepe/theme/common/block-edit.css';
import '@milkdown/crepe/theme/common/code-mirror.css';
import '@milkdown/crepe/theme/common/cursor.css';
import '@milkdown/crepe/theme/common/latex.css';
import '@milkdown/crepe/theme/common/link-tooltip.css';
import '@milkdown/crepe/theme/common/list-item.css';
import '@milkdown/crepe/theme/common/placeholder.css';
import '@milkdown/crepe/theme/common/table.css';
import '@milkdown/crepe/theme/common/toolbar.css';
import {
  editorViewCtx,
  editorViewOptionsCtx,
  parserCtx,
  remarkCtx,
  remarkStringifyOptionsCtx,
  schemaCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import type { Node } from '@milkdown/kit/prose/model';
import { Plugin } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import type { Translate } from '$lib/ports';
import { codeHighlighting } from '../editor/theme';
import type { LineBlock } from '../preview/viewNavigation';
import { crepeTexts } from './crepeTexts';
import {
  applyBlockEdit,
  blockRanges,
  commonEnds,
  lineAt,
  lineEndingOf,
  restoreSyntax,
  splitPrefix,
  withLineEnding,
  type BlockRange,
  type IndexedBody,
} from './sourceBlocks';

export interface VisualEditorOptions {
  /** The whole document, front matter included. */
  readonly content: string;
  readonly t: Translate;
  /** Called with the whole new document after each user edit. */
  readonly onEdit: (content: string) => void;
  /** SVG for a Mermaid diagram, or null when it cannot be drawn. */
  readonly drawDiagram: (source: string) => Promise<string | null>;
}

export interface VisualEditor {
  readonly view: EditorView;
  /** The document text the editor currently stands for. */
  readonly source: string;
  /** Shows a document changed from outside, keeping the selection where the text is unchanged. */
  setSource(content: string): void;
  /** The blocks on screen with their source lines, for scrolling by line. */
  shownBlocks(): LineBlock[];
  destroy(): Promise<void>;
}

/** What the user interacting with the editor looks like; until then no change is theirs. */
const USER_EVENTS = ['keydown', 'beforeinput', 'pointerdown', 'paste', 'drop', 'cut'] as const;
const LEADING_BREAKS_TRAILING_SPACE = /^(?:\r?\n)+|\s+$/g;

interface MdastRoot {
  readonly children: readonly {
    readonly position?: { start: { offset?: number }; end: { offset?: number } };
  }[];
}

/** Top-level blocks, without the empty paragraph Milkdown keeps at the end for the caret. */
function topBlocks(doc: Node): Node[] {
  const blocks: Node[] = [];
  doc.forEach((node) => blocks.push(node));
  while (blocks.at(-1)?.type.name === 'paragraph' && blocks.at(-1)?.content.size === 0) {
    blocks.pop();
  }
  return blocks;
}

function crepeFor(root: HTMLElement, body: string, options: VisualEditorOptions): Crepe {
  const texts = crepeTexts(options.t);
  return new Crepe({
    root,
    defaultValue: body,
    features: {
      [CrepeFeature.ImageBlock]: false,
      [CrepeFeature.TopBar]: false,
      [CrepeFeature.AI]: false,
    },
    featureConfigs: {
      ...texts,
      [CrepeFeature.CodeMirror]: {
        ...texts[CrepeFeature.CodeMirror],
        theme: codeHighlighting,
        languages,
        renderPreview: (language, source, apply) => {
          if (language.toLowerCase() !== 'mermaid' || source.trim() === '') return null;
          void options.drawDiagram(source).then(apply);
        },
      },
    },
  });
}

function configure(ctx: Ctx, label: string): void {
  // The author's usual list and rule markers rather than remark's `*`.
  ctx.update(remarkStringifyOptionsCtx, (prev) => ({
    ...prev,
    bullet: '-' as const,
    rule: '-' as const,
  }));
  ctx.update(editorViewOptionsCtx, (prev) => ({
    ...prev,
    attributes: { class: 'markdown-body', 'aria-label': label },
  }));
}

export async function createVisualEditor(
  root: HTMLElement,
  options: VisualEditorOptions,
): Promise<VisualEditor> {
  let split = splitPrefix(options.content);
  let source = options.content;
  let indexed: IndexedBody = { body: split.body, ranges: [] };
  // The editor blocks `indexed.ranges` describe, one for one when `aligned`.
  let shown: Node[] = [];
  let aligned = false;
  let ready = false;
  let interacted = false;
  let applyingOutside = false;

  const crepe = crepeFor(root, split.body, options);
  const ctx = <T>(read: (ctx: Ctx) => T): T => crepe.editor.action(read);

  /** Block ranges of a Markdown text, as Milkdown's own parser sees its blocks. */
  function rangesOf(text: string): BlockRange[] {
    const tree = ctx((c) => {
      const remark = c.get(remarkCtx);
      return remark.runSync(remark.parse(text), text) as unknown as MdastRoot;
    });
    const spans = tree.children.map(({ position }) => {
      const from = position?.start.offset;
      const to = position?.end.offset;
      return from === undefined || to === undefined ? null : { from, to };
    });
    return blockRanges(text, spans);
  }

  function markdownOf(blocks: readonly Node[]): string {
    const markdown = ctx((c) =>
      c.get(serializerCtx)(c.get(schemaCtx).topNodeType.create(null, blocks)),
    );
    return withLineEnding(
      restoreSyntax(markdown).replace(LEADING_BREAKS_TRAILING_SPACE, ''),
      lineEndingOf(indexed.body),
    );
  }

  /** Same block for the round trip: equal nodes, or nodes that write the same Markdown. */
  const sameBlock = (a: Node, b: Node): boolean => a.eq(b) || markdownOf([a]) === markdownOf([b]);

  function rebase(body: string, blocks: Node[]): void {
    indexed = { body, ranges: rangesOf(body) };
    shown = blocks;
    aligned = indexed.ranges.length === blocks.length;
  }

  /** The new body after an edit, splicing only the changed blocks when the index allows it. */
  function bodyAfter(blocks: Node[]): IndexedBody | null {
    if (!aligned) return null;
    const { head, tail } = commonEnds(shown, blocks, sameBlock);
    const changed = blocks.slice(head, blocks.length - tail);
    const middle = changed.length === 0 ? '' : markdownOf(changed);
    const middleRanges = rangesOf(middle);
    if (middleRanges.length !== changed.length) return null;
    return applyBlockEdit(indexed, { head, tail, middle, middleRanges });
  }

  function onDocChanged(doc: Node): void {
    if (!ready || applyingOutside) return;
    const blocks = topBlocks(doc);
    if (!interacted) {
      shown = blocks;
      aligned = indexed.ranges.length === blocks.length;
      return;
    }
    const next = bodyAfter(blocks);
    if (next) {
      indexed = next;
      shown = blocks;
    } else {
      // The index no longer matches the editor: fall back to its whole serialisation.
      rebase(markdownOf(blocks) + lineEndingOf(indexed.body), blocks);
    }
    const content = split.prefix + indexed.body;
    if (content === source) return;
    source = content;
    options.onEdit(content);
  }

  const watchChanges = $prose(
    () =>
      new Plugin({
        view: () => ({
          update: (view, previous) => {
            if (view.state.doc !== previous.doc) onDocChanged(view.state.doc);
          },
        }),
      }),
  );

  const markInteraction = () => (interacted = true);
  for (const type of USER_EVENTS) root.addEventListener(type, markInteraction, true);

  crepe.editor.config((c) => configure(c, options.t('visual.label'))).use(watchChanges);
  await crepe.create();
  const view = ctx((c) => c.get(editorViewCtx));
  rebase(split.body, topBlocks(view.state.doc));
  ready = true;

  function setSource(content: string): void {
    split = splitPrefix(content);
    source = content;
    const next = ctx((c) => c.get(parserCtx)(split.body));
    const { doc } = view.state;
    const start = doc.content.findDiffStart(next.content);
    if (start !== null) {
      let { a: endOld, b: endNew } = doc.content.findDiffEnd(next.content)!;
      const overlap = start - Math.min(endOld, endNew);
      if (overlap > 0) {
        endOld += overlap;
        endNew += overlap;
      }
      applyingOutside = true;
      try {
        view.dispatch(
          view.state.tr
            .replace(start, endOld, next.slice(start, endNew))
            .setMeta('addToHistory', false),
        );
      } finally {
        applyingOutside = false;
      }
    }
    rebase(split.body, topBlocks(view.state.doc));
  }

  function shownBlocks(): LineBlock[] {
    if (!aligned) return [];
    const blocks: LineBlock[] = [];
    view.state.doc.forEach((_node, offset, index) => {
      const element = view.nodeDOM(offset);
      const range = indexed.ranges[index];
      if (!(element instanceof Element) || !range) return;
      blocks.push({ element, start: split.bodyStartLine + lineAt(indexed.body, range.from) });
    });
    return blocks;
  }

  return {
    view,
    get source() {
      return source;
    },
    setSource,
    shownBlocks,
    destroy: async () => {
      for (const type of USER_EVENTS) root.removeEventListener(type, markInteraction, true);
      await crepe.destroy();
    },
  };
}
