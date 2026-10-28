import { describe, expect, it } from 'vitest';
import type { DirEntry } from '$lib/ports';
import {
  ancestorsWithin,
  collapse,
  emptyTree,
  expand,
  firstChildPath,
  firstPath,
  foldersToLoad,
  isExpandable,
  lastPath,
  nextPath,
  parentPath,
  previousPath,
  toggle,
  visibleRows,
  withChildren,
  withoutListings,
} from './tree';

const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const folder = (path: string, hasChildren = true): DirEntry => ({
  name: nameOf(path),
  path,
  kind: 'folder',
  hasChildren,
});
const file = (path: string): DirEntry => ({ name: nameOf(path), path, kind: 'file' });

const loaded = withChildren(
  withChildren(
    withChildren(emptyTree, '/r', [folder('/r/a'), folder('/r/empty', false), file('/r/z.md')]),
    '/r/a',
    [folder('/r/a/b'), file('/r/a/x.md')],
  ),
  '/r/a/b',
  [file('/r/a/b/deep.md')],
);
const paths = (state = loaded) => visibleRows(state, '/r').map((row) => row.entry.path);

describe('expansion', () => {
  it('toggles, expands and collapses without mutating the previous state', () => {
    const opened = toggle(emptyTree, '/r/a');
    expect([...opened.expanded]).toEqual(['/r/a']);
    expect([...emptyTree.expanded]).toEqual([]);
    expect([...expand(opened, '/r/b', '/r/c').expanded]).toEqual(['/r/a', '/r/b', '/r/c']);
    expect([...toggle(opened, '/r/a').expanded]).toEqual([]);
    expect([...collapse(opened, '/r/a').expanded]).toEqual([]);
    expect([...opened.expanded]).toEqual(['/r/a']);
  });

  it('only folders that have children are expandable', () => {
    expect(isExpandable(folder('/r/a'))).toBe(true);
    expect(isExpandable(folder('/r/e', false))).toBe(false);
    expect(isExpandable(file('/r/x.md'))).toBe(false);
  });
});

describe('visibleRows', () => {
  it('lists only the root entries while nothing is expanded', () => {
    expect(paths()).toEqual(['/r/a', '/r/empty', '/r/z.md']);
  });

  it('shows the children of expanded folders right after them, with levels and parents', () => {
    const rows = visibleRows(expand(loaded, '/r/a', '/r/a/b'), '/r');
    expect(rows.map((r) => [r.entry.path, r.level, r.parent, r.expanded])).toEqual([
      ['/r/a', 1, null, true],
      ['/r/a/b', 2, '/r/a', true],
      ['/r/a/b/deep.md', 3, '/r/a/b', false],
      ['/r/a/x.md', 2, '/r/a', false],
      ['/r/empty', 1, null, false],
      ['/r/z.md', 1, null, false],
    ]);
  });

  it('does not expand a folder without children, and skips folders not loaded yet', () => {
    expect(paths(expand(loaded, '/r/empty'))).toEqual(['/r/a', '/r/empty', '/r/z.md']);
    expect(visibleRows(expand(emptyTree, '/r/a'), '/r')).toEqual([]);
  });

  it('marks expandable rows', () => {
    expect(visibleRows(loaded, '/r').map((r) => r.expandable)).toEqual([true, false, false]);
  });
});

describe('listings', () => {
  it('replaces the listing of one folder', () => {
    const refreshed = withChildren(loaded, '/r', [file('/r/new.md')]);
    expect(paths(refreshed)).toEqual(['/r/new.md']);
    expect(refreshed.children.get('/r/a')).toBe(loaded.children.get('/r/a'));
  });

  it('forgets all listings but keeps the expanded folders', () => {
    const cleared = withoutListings(expand(loaded, '/r/a'));
    expect(cleared.children.size).toBe(0);
    expect([...cleared.expanded]).toEqual(['/r/a']);
  });

  it('asks for the root and the expanded folders that are not loaded', () => {
    expect(foldersToLoad(emptyTree, '/r')).toEqual(['/r']);
    expect(foldersToLoad(loaded, '/r')).toEqual([]);
    const pending = expand(withChildren(emptyTree, '/r', [folder('/r/a')]), '/r/a');
    expect(foldersToLoad(pending, '/r')).toEqual(['/r/a']);
  });
});

describe('ancestorsWithin', () => {
  it('returns the folders from the root down to the file', () => {
    expect(ancestorsWithin('/r', '/r/a/b/deep.md')).toEqual(['/r/a', '/r/a/b']);
  });

  it('is empty for a file directly in the root or outside it', () => {
    expect(ancestorsWithin('/r', '/r/z.md')).toEqual([]);
    expect(ancestorsWithin('/r', '/other/z.md')).toEqual([]);
  });

  it('honours case-insensitive file systems', () => {
    expect(ancestorsWithin('/R', '/r/a/x.md', true)).toEqual(['/r/a']);
    expect(ancestorsWithin('/R', '/r/a/x.md')).toEqual([]);
  });
});

describe('navigation', () => {
  const rows = visibleRows(expand(loaded, '/r/a'), '/r');
  // /r/a, /r/a/b, /r/a/x.md, /r/empty, /r/z.md

  it('moves to the next and previous row, stopping at the ends', () => {
    expect(nextPath(rows, '/r/a')).toBe('/r/a/b');
    expect(nextPath(rows, '/r/z.md')).toBeNull();
    expect(previousPath(rows, '/r/a/b')).toBe('/r/a');
    expect(previousPath(rows, '/r/a')).toBeNull();
  });

  it('finds the first and last rows', () => {
    expect(firstPath(rows)).toBe('/r/a');
    expect(lastPath(rows)).toBe('/r/z.md');
    expect(firstPath([])).toBeNull();
    expect(lastPath([])).toBeNull();
  });

  it('finds the parent folder', () => {
    expect(parentPath(rows, '/r/a/x.md')).toBe('/r/a');
    expect(parentPath(rows, '/r/a')).toBeNull();
    expect(parentPath(rows, '/nope')).toBeNull();
  });

  it('finds the first child of an expanded folder only', () => {
    expect(firstChildPath(rows, '/r/a')).toBe('/r/a/b');
    expect(firstChildPath(rows, '/r/a/b')).toBeNull();
    expect(firstChildPath(rows, '/r/z.md')).toBeNull();
    expect(firstChildPath(rows, '/nope')).toBeNull();
  });

  it('has no first child when the expanded folder turned out empty', () => {
    const emptied = visibleRows(expand(withChildren(loaded, '/r/a', []), '/r/a'), '/r');
    expect(firstChildPath(emptied, '/r/a')).toBeNull();
  });
});
