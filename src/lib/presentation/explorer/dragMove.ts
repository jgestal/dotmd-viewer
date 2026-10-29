// The state machine behind dragging inside the sidebar: pressing a row, crossing the threshold,
// finding what the pointer is over and what a drop there would do. Pure data in, data out; the
// DOM side (listeners, ghost, timers) lives in dragController.svelte.ts.
import { dirName, isSameOrInside, isSamePath } from '$lib/domain/paths';
import type { EntryKind } from '$lib/ports';

/** The pointer must travel this far (px) from where it was pressed before a drag begins. */
export const DRAG_THRESHOLD = 4;
/** Hovering a collapsed folder this long (ms) expands it. */
export const EXPAND_DELAY_MS = 700;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** What is being dragged: a row of the tree, or an item of the favourites list. */
export type DragSource =
  | { readonly kind: 'entry'; readonly path: string; readonly entryKind: EntryKind }
  | {
      readonly kind: 'favourite';
      readonly index: number;
      readonly path: string;
      readonly entryKind: EntryKind;
    };

/** What the pointer is over. */
export type Hit =
  | { readonly zone: 'row'; readonly path: string; readonly entryKind: EntryKind }
  /** The explorer header, which stands for the root folder. */
  | { readonly zone: 'root'; readonly path: string }
  /** The Favourites tab button or the empty part of the list. */
  | { readonly zone: 'favourites' }
  | { readonly zone: 'favourite'; readonly index: number };

/** What releasing the pointer would do. */
export type DropTarget =
  | { readonly action: 'move'; readonly folder: string }
  | { readonly action: 'favourite' }
  | { readonly action: 'reorder'; readonly to: number };

export interface DropContext {
  readonly isFavourite: (path: string) => boolean;
}

export interface Drag {
  readonly source: DragSource;
  readonly origin: Point;
  readonly point: Point;
  /** False until the pointer has travelled past the threshold. */
  readonly active: boolean;
  readonly hit: Hit | null;
  /** Null when the pointer is over nothing, or over a place where a drop does nothing. */
  readonly target: DropTarget | null;
}

const moveInto = (source: DragSource, folder: string): DropTarget | null =>
  isSameOrInside(source.path, folder) || isSamePath(dirName(source.path), folder)
    ? null
    : { action: 'move', folder };

/** The folder a drop on `hit` lands in: the folder itself, or the parent of a file. */
const folderOf = (hit: Extract<Hit, { zone: 'row' | 'root' }>): string =>
  hit.zone === 'root' || hit.entryKind === 'folder' ? hit.path : dirName(hit.path);

function resolveEntryDrop(
  source: DragSource,
  hit: Hit,
  { isFavourite }: DropContext,
): DropTarget | null {
  if (hit.zone === 'favourites' || hit.zone === 'favourite') {
    return isFavourite(source.path) ? null : { action: 'favourite' };
  }
  return hit.zone === 'row' || hit.zone === 'root' ? moveInto(source, folderOf(hit)) : null;
}

/** What dropping `source` on `hit` does; `null` means nothing, and nothing is highlighted. */
export function resolveDropTarget(
  source: DragSource,
  hit: Hit | null,
  context: DropContext,
): DropTarget | null {
  if (hit === null) return null;
  if (source.kind === 'entry') return resolveEntryDrop(source, hit, context);
  return hit.zone === 'favourite' && hit.index !== source.index
    ? { action: 'reorder', to: hit.index }
    : null;
}

export const press = (source: DragSource, origin: Point): Drag => ({
  source,
  origin,
  point: origin,
  active: false,
  hit: null,
  target: null,
});

/** Follows the pointer; the drag becomes active once it has travelled `DRAG_THRESHOLD`. */
export function pointerMoved(
  drag: Drag,
  point: Point,
  hit: Hit | null,
  context: DropContext,
): Drag {
  const active =
    drag.active || Math.hypot(point.x - drag.origin.x, point.y - drag.origin.y) >= DRAG_THRESHOLD;
  if (!active) return { ...drag, point };
  return { ...drag, point, active, hit, target: resolveDropTarget(drag.source, hit, context) };
}

/** What a release does: the target of an active drag, nothing for a plain click. */
export const dropOf = (drag: Drag): DropTarget | null => (drag.active ? drag.target : null);

/** The folder row being hovered, which expands after `EXPAND_DELAY_MS`. */
export const hoveredFolder = (drag: Drag): string | null =>
  drag.active && drag.hit?.zone === 'row' && drag.hit.entryKind === 'folder' ? drag.hit.path : null;

/** The folder whose row (or the explorer header) lights up as the drop destination. */
export const highlightedFolder = (drag: Drag | null): string | null =>
  drag?.target?.action === 'move' ? drag.target.folder : null;
