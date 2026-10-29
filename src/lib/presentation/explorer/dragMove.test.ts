import { describe, expect, it } from 'vitest';
import {
  DRAG_THRESHOLD,
  dropOf,
  highlightedFolder,
  hoveredFolder,
  pointerMoved,
  press,
  resolveDropTarget,
  type DragSource,
  type Hit,
} from './dragMove';

const file: DragSource = { kind: 'entry', path: '/w/notes/a.md', entryKind: 'file' };
const folder: DragSource = { kind: 'entry', path: '/w/notes', entryKind: 'folder' };
const none = { isFavourite: () => false };

const row = (path: string, entryKind: 'file' | 'folder'): Hit => ({ zone: 'row', path, entryKind });

describe('resolveDropTarget for a tree entry', () => {
  it('drops into the folder row it is over', () => {
    expect(resolveDropTarget(file, row('/w/docs', 'folder'), none)).toEqual({
      action: 'move',
      folder: '/w/docs',
    });
  });

  it('drops next to a file row, which means into that file parent', () => {
    expect(resolveDropTarget(file, row('/w/docs/b.md', 'file'), none)).toEqual({
      action: 'move',
      folder: '/w/docs',
    });
  });

  it('drops into the root from the header', () => {
    expect(resolveDropTarget(file, { zone: 'root', path: '/w' }, none)).toEqual({
      action: 'move',
      folder: '/w',
    });
  });

  it('does nothing over its own parent folder row', () => {
    expect(resolveDropTarget(file, row('/w/notes', 'folder'), none)).toBeNull();
  });

  it('does nothing over a sibling file, whose parent is the same folder', () => {
    expect(resolveDropTarget(file, row('/w/notes/b.md', 'file'), none)).toBeNull();
  });

  it('does nothing over the root when the entry already lives there', () => {
    const atRoot: DragSource = { kind: 'entry', path: '/w/a.md', entryKind: 'file' };
    expect(resolveDropTarget(atRoot, { zone: 'root', path: '/w' }, none)).toBeNull();
  });

  it('does nothing when a folder is dropped on itself', () => {
    expect(resolveDropTarget(folder, row('/w/notes', 'folder'), none)).toBeNull();
  });

  it('does nothing when a folder is dropped on its descendant', () => {
    expect(resolveDropTarget(folder, row('/w/notes/sub', 'folder'), none)).toBeNull();
    expect(resolveDropTarget(folder, row('/w/notes/sub/x.md', 'file'), none)).toBeNull();
  });

  it('treats a folder with a similar name as a different folder', () => {
    expect(resolveDropTarget(folder, row('/w/notes-old', 'folder'), none)).toEqual({
      action: 'move',
      folder: '/w/notes-old',
    });
  });

  it('adds a favourite over the Favourites tab or list', () => {
    expect(resolveDropTarget(file, { zone: 'favourites' }, none)).toEqual({ action: 'favourite' });
    expect(resolveDropTarget(file, { zone: 'favourite', index: 2 }, none)).toEqual({
      action: 'favourite',
    });
  });

  it('does nothing over the favourites when the entry is already a favourite', () => {
    const known = { isFavourite: (path: string) => path === file.path };
    expect(resolveDropTarget(file, { zone: 'favourites' }, known)).toBeNull();
  });

  it('does nothing over no target', () => {
    expect(resolveDropTarget(file, null, none)).toBeNull();
  });
});

describe('resolveDropTarget for a favourite', () => {
  const favourite: DragSource = { kind: 'favourite', index: 1, path: '/w/a.md', entryKind: 'file' };

  it('reorders onto another favourite', () => {
    expect(resolveDropTarget(favourite, { zone: 'favourite', index: 3 }, none)).toEqual({
      action: 'reorder',
      to: 3,
    });
  });

  it('does nothing over itself, the list background or the tree', () => {
    expect(resolveDropTarget(favourite, { zone: 'favourite', index: 1 }, none)).toBeNull();
    expect(resolveDropTarget(favourite, { zone: 'favourites' }, none)).toBeNull();
    expect(resolveDropTarget(favourite, row('/w/docs', 'folder'), none)).toBeNull();
  });
});

describe('pointerMoved', () => {
  const start = press(file, { x: 10, y: 10 });

  it('stays pending below the threshold', () => {
    const drag = pointerMoved(start, { x: 10 + DRAG_THRESHOLD - 1, y: 10 }, null, none);
    expect(drag.active).toBe(false);
    expect(drag.point).toEqual({ x: 13, y: 10 });
  });

  it('activates at exactly the threshold, in any direction', () => {
    expect(pointerMoved(start, { x: 10, y: 10 + DRAG_THRESHOLD }, null, none).active).toBe(true);
    expect(pointerMoved(start, { x: 6, y: 10 }, null, none).active).toBe(true);
  });

  it('measures the threshold as a distance, not per axis', () => {
    expect(pointerMoved(start, { x: 12, y: 12 }, null, none).active).toBe(false);
    expect(pointerMoved(start, { x: 13, y: 13 }, null, none).active).toBe(true);
  });

  it('resolves the target once active and keeps the hit', () => {
    const hit = row('/w/docs', 'folder');
    const drag = pointerMoved(start, { x: 40, y: 40 }, hit, none);
    expect(drag.hit).toBe(hit);
    expect(drag.target).toEqual({ action: 'move', folder: '/w/docs' });
  });

  it('stays active after coming back near the origin', () => {
    const away = pointerMoved(start, { x: 40, y: 40 }, null, none);
    expect(pointerMoved(away, { x: 10, y: 10 }, null, none).active).toBe(true);
  });

  it('ignores hits while pending', () => {
    const drag = pointerMoved(start, { x: 11, y: 10 }, row('/w/docs', 'folder'), none);
    expect(drag.hit).toBeNull();
    expect(drag.target).toBeNull();
  });
});

describe('what a release and a hover mean', () => {
  const over = (hit: Hit | null) =>
    pointerMoved(press(file, { x: 0, y: 0 }), { x: 50, y: 0 }, hit, none);

  it('drops on the target of an active drag', () => {
    expect(dropOf(over(row('/w/docs', 'folder')))).toEqual({ action: 'move', folder: '/w/docs' });
  });

  it('drops nothing for a plain click', () => {
    expect(dropOf(press(file, { x: 0, y: 0 }))).toBeNull();
  });

  it('reports the hovered folder row, even where a drop would do nothing', () => {
    expect(hoveredFolder(over(row('/w/docs', 'folder')))).toBe('/w/docs');
    expect(hoveredFolder(over(row('/w/notes', 'folder')))).toBe('/w/notes');
  });

  it('reports no hovered folder over files, the root or nothing', () => {
    expect(hoveredFolder(over(row('/w/docs/b.md', 'file')))).toBeNull();
    expect(hoveredFolder(over({ zone: 'root', path: '/w' }))).toBeNull();
    expect(hoveredFolder(over(null))).toBeNull();
    expect(hoveredFolder(press(file, { x: 0, y: 0 }))).toBeNull();
  });

  it('highlights the destination folder of a move only', () => {
    expect(highlightedFolder(over(row('/w/docs/b.md', 'file')))).toBe('/w/docs');
    expect(highlightedFolder(over({ zone: 'root', path: '/w' }))).toBe('/w');
    expect(highlightedFolder(over({ zone: 'favourites' }))).toBeNull();
    expect(highlightedFolder(over(row('/w/notes', 'folder')))).toBeNull();
    expect(highlightedFolder(null)).toBeNull();
  });
});
