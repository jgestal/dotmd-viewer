import type { EditorView } from '@codemirror/view';
import { lineAtScrollTop, scrollToLine } from '../editor/position';
import { blockOffsets } from '../preview/viewNavigation';
import { buildAnchors, lineForOffset, offsetForLine, type Anchor } from './scrollSync';

// Moves one pane to where the other one is, with the DOM of both panes at hand. The maths is in
// `scrollSync`; this only measures the panes and applies the result.

const maxScroll = (element: HTMLElement): number =>
  Math.max(element.scrollHeight - element.clientHeight, 0);

/** Anchors tying the preview's scroll offsets to source lines, ended where the editor ends. */
function previewAnchors(view: EditorView, preview: HTMLElement): readonly Anchor[] {
  const editorEnd = lineAtScrollTop(view, maxScroll(view.scrollDOM));
  return buildAnchors(blockOffsets(preview, preview), {
    line: editorEnd,
    offset: maxScroll(preview),
  });
}

const canScroll = (view: EditorView, preview: HTMLElement): boolean =>
  maxScroll(view.scrollDOM) > 0 && maxScroll(preview) > 0;

/** Scrolls the preview to the line at the top of the editor. */
export function followEditor(view: EditorView, preview: HTMLElement): void {
  if (!canScroll(view, preview)) return;
  const line = lineAtScrollTop(view, view.scrollDOM.scrollTop);
  preview.scrollTop = offsetForLine(previewAnchors(view, preview), line);
}

/** Scrolls the editor to the line at the top of the preview. */
export function followPreview(view: EditorView, preview: HTMLElement): void {
  if (!canScroll(view, preview)) return;
  scrollToLine(view, lineForOffset(previewAnchors(view, preview), preview.scrollTop));
}
