import { describe, expect, it } from 'vitest';
import {
  addFavourite,
  closeFolder,
  emptyWorkspace,
  forgetPath,
  isFavourite,
  moveFavourite,
  openFolder,
  removeFavourite,
  renamePath,
  toggleFavourite,
  withMissing,
  type Favourite,
  type Workspace,
} from './workspace';

const file = (path: string): Favourite => ({ path, kind: 'file' });
const folder = (path: string): Favourite => ({ path, kind: 'folder' });
const withFavourites = (...favourites: Favourite[]): Workspace => ({ folder: null, favourites });
const paths = (workspace: Workspace) => workspace.favourites.map((f) => f.path);

describe('openFolder / closeFolder', () => {
  it('starts with no folder and no favourites', () => {
    expect(emptyWorkspace).toEqual({ folder: null, favourites: [] });
  });

  it('opens a folder keeping favourites', () => {
    const ws = openFolder(withFavourites(file('/a.md')), '/notes');
    expect(ws).toEqual({ folder: '/notes', favourites: [file('/a.md')] });
  });

  it('replaces the open folder', () => {
    expect(openFolder(openFolder(emptyWorkspace, '/a'), '/b').folder).toBe('/b');
  });

  it('closes the folder keeping favourites', () => {
    const ws = closeFolder({ folder: '/notes', favourites: [file('/a.md')] });
    expect(ws).toEqual({ folder: null, favourites: [file('/a.md')] });
  });

  it('does not mutate its input', () => {
    openFolder(emptyWorkspace, '/a');
    expect(emptyWorkspace.folder).toBeNull();
  });
});

describe('addFavourite', () => {
  it('appends a new favourite', () => {
    const ws = addFavourite(withFavourites(file('/a.md')), folder('/b'));
    expect(ws.favourites).toEqual([file('/a.md'), folder('/b')]);
  });

  it('ignores duplicates with trailing slash or other separators', () => {
    const ws = withFavourites(folder('C:\\docs'));
    expect(addFavourite(ws, folder('C:/docs/'))).toBe(ws);
  });

  it('treats different case as different by default', () => {
    expect(paths(addFavourite(withFavourites(file('/A.md')), file('/a.md')))).toEqual([
      '/A.md',
      '/a.md',
    ]);
  });

  it('ignores case differences when case-insensitive', () => {
    const ws = withFavourites(file('/A.md'));
    expect(addFavourite(ws, file('/a.md'), true)).toBe(ws);
  });

  it('does not mutate its input', () => {
    const ws = withFavourites();
    addFavourite(ws, file('/a.md'));
    expect(ws.favourites).toEqual([]);
  });
});

describe('removeFavourite', () => {
  it('removes by normalised path', () => {
    const ws = withFavourites(file('/a.md'), folder('/b'));
    expect(paths(removeFavourite(ws, '/b/'))).toEqual(['/a.md']);
  });

  it('keeps everything when the path is unknown', () => {
    const ws = withFavourites(file('/a.md'));
    expect(removeFavourite(ws, '/zzz').favourites).toEqual([file('/a.md')]);
  });

  it('respects the case-insensitive flag', () => {
    const ws = withFavourites(file('/A.md'));
    expect(removeFavourite(ws, '/a.md').favourites).toHaveLength(1);
    expect(removeFavourite(ws, '/a.md', true).favourites).toHaveLength(0);
  });

  it('keeps the open folder', () => {
    expect(removeFavourite({ folder: '/x', favourites: [file('/a')] }, '/a').folder).toBe('/x');
  });
});

describe('isFavourite', () => {
  it('finds favourites regardless of separators', () => {
    expect(isFavourite(withFavourites(file('C:\\a\\b.md')), 'C:/a/b.md')).toBe(true);
  });

  it('is false for unknown paths and for descendants', () => {
    const ws = withFavourites(folder('/a'));
    expect(isFavourite(ws, '/b')).toBe(false);
    expect(isFavourite(ws, '/a/b')).toBe(false);
  });

  it('respects the case-insensitive flag', () => {
    const ws = withFavourites(file('/A.md'));
    expect(isFavourite(ws, '/a.md')).toBe(false);
    expect(isFavourite(ws, '/a.md', true)).toBe(true);
  });
});

describe('toggleFavourite', () => {
  it('adds a missing favourite', () => {
    expect(toggleFavourite(emptyWorkspace, file('/a.md')).favourites).toEqual([file('/a.md')]);
  });

  it('removes an existing favourite', () => {
    expect(toggleFavourite(withFavourites(file('/a.md')), file('/a.md/')).favourites).toEqual([]);
  });

  it('honours the case-insensitive flag', () => {
    expect(toggleFavourite(withFavourites(file('/A.md')), file('/a.md'), true).favourites).toEqual(
      [],
    );
    expect(toggleFavourite(withFavourites(file('/A.md')), file('/a.md')).favourites).toHaveLength(
      2,
    );
  });
});

describe('moveFavourite', () => {
  const ws = withFavourites(file('/a'), file('/b'), file('/c'), file('/d'));

  it('moves an item forward', () => {
    expect(paths(moveFavourite(ws, 0, 2))).toEqual(['/b', '/c', '/a', '/d']);
  });

  it('moves an item backward', () => {
    expect(paths(moveFavourite(ws, 3, 1))).toEqual(['/a', '/d', '/b', '/c']);
  });

  it('is a no-op when indices are equal', () => {
    expect(moveFavourite(ws, 2, 2)).toBe(ws);
  });

  it('clamps a target beyond the end', () => {
    expect(paths(moveFavourite(ws, 0, 99))).toEqual(['/b', '/c', '/d', '/a']);
  });

  it('clamps a negative target', () => {
    expect(paths(moveFavourite(ws, 2, -5))).toEqual(['/c', '/a', '/b', '/d']);
  });

  it('clamps a source beyond the end to the last item', () => {
    expect(paths(moveFavourite(ws, 99, 0))).toEqual(['/d', '/a', '/b', '/c']);
  });

  it('is a no-op when clamping makes both indices equal', () => {
    expect(moveFavourite(ws, 50, 99)).toBe(ws);
  });

  it('is a no-op on an empty list', () => {
    expect(moveFavourite(emptyWorkspace, 0, 3)).toBe(emptyWorkspace);
  });

  it('does not mutate its input', () => {
    moveFavourite(ws, 0, 3);
    expect(paths(ws)).toEqual(['/a', '/b', '/c', '/d']);
  });
});

describe('renamePath', () => {
  it('renames a favourite file', () => {
    const ws = renamePath(withFavourites(file('/a/x.md')), '/a/x.md', '/a/y.md');
    expect(ws.favourites).toEqual([file('/a/y.md')]);
  });

  it('renames descendants of a renamed folder, keeping their kind', () => {
    const ws = renamePath(withFavourites(folder('/a/b'), file('/a/b/c/d.md')), '/a/b', '/a/z');
    expect(ws.favourites).toEqual([folder('/a/z'), file('/a/z/c/d.md')]);
  });

  it('does not touch siblings sharing a string prefix', () => {
    const ws = renamePath(withFavourites(file('/a/bc'), file('/a/bc/d.md')), '/a/b', '/a/z');
    expect(ws.favourites).toEqual([file('/a/bc'), file('/a/bc/d.md')]);
  });

  it('does not touch unrelated favourites', () => {
    const ws = withFavourites(file('/other.md'));
    expect(renamePath(ws, '/a', '/b').favourites).toEqual([file('/other.md')]);
  });

  it('renames the open folder and folders inside it', () => {
    expect(renamePath({ folder: '/a/b', favourites: [] }, '/a/b', '/a/z').folder).toBe('/a/z');
    expect(renamePath({ folder: '/a/b/c', favourites: [] }, '/a/b', '/a/z').folder).toBe('/a/z/c');
  });

  it('leaves a null or unrelated folder alone', () => {
    expect(renamePath(emptyWorkspace, '/a', '/b').folder).toBeNull();
    expect(renamePath({ folder: '/c', favourites: [] }, '/a', '/b').folder).toBe('/c');
  });

  it('handles moves to another directory', () => {
    const ws = renamePath(withFavourites(file('/a/b/c.md')), '/a/b', '/x/y/b');
    expect(paths(ws)).toEqual(['/x/y/b/c.md']);
  });

  it('works with Windows paths and keeps the new separator style', () => {
    const ws = renamePath(
      withFavourites(file('C:\\docs\\old\\a.md')),
      'C:\\docs\\old',
      'C:\\docs\\new',
    );
    expect(paths(ws)).toEqual(['C:\\docs\\new\\a.md']);
  });

  it('matches the old path across separator styles and trailing slash', () => {
    const ws = renamePath(
      withFavourites(file('C:\\docs\\old\\a.md')),
      'C:/docs/old/',
      'C:\\docs\\new',
    );
    expect(paths(ws)).toEqual(['C:\\docs\\new\\a.md']);
  });

  it('works with UNC paths', () => {
    const ws = renamePath(
      withFavourites(file('\\\\srv\\share\\a\\b.md')),
      '\\\\srv\\share\\a',
      '\\\\srv\\share\\z',
    );
    expect(paths(ws)).toEqual(['\\\\srv\\share\\z\\b.md']);
  });

  it('is case-sensitive by default and case-insensitive on request', () => {
    const ws = withFavourites(file('/A/b.md'));
    expect(paths(renamePath(ws, '/a', '/z'))).toEqual(['/A/b.md']);
    expect(paths(renamePath(ws, '/a', '/z', true))).toEqual(['/z/b.md']);
  });

  it('drops a favourite that becomes a duplicate after renaming', () => {
    const ws = renamePath(withFavourites(file('/a.md'), file('/b.md')), '/a.md', '/b.md');
    expect(ws.favourites).toEqual([file('/b.md')]);
  });

  it('does not mutate its input', () => {
    const ws = withFavourites(file('/a.md'));
    renamePath(ws, '/a.md', '/b.md');
    expect(paths(ws)).toEqual(['/a.md']);
  });
});

describe('forgetPath', () => {
  it('removes the deleted favourite', () => {
    expect(paths(forgetPath(withFavourites(file('/a.md'), file('/b.md')), '/a.md'))).toEqual([
      '/b.md',
    ]);
  });

  it('removes favourites under a deleted folder', () => {
    const ws = withFavourites(folder('/a/b'), file('/a/b/c.md'), file('/a/bc.md'), file('/a/d.md'));
    expect(paths(forgetPath(ws, '/a/b/'))).toEqual(['/a/bc.md', '/a/d.md']);
  });

  it('keeps ancestors of the deleted path', () => {
    expect(paths(forgetPath(withFavourites(folder('/a')), '/a/b'))).toEqual(['/a']);
  });

  it('works with Windows separators and case-insensitivity', () => {
    const ws = withFavourites(file('C:\\Docs\\a.md'));
    expect(forgetPath(ws, 'C:/docs').favourites).toHaveLength(1);
    expect(forgetPath(ws, 'C:/docs', true).favourites).toHaveLength(0);
  });

  it('keeps the open folder', () => {
    expect(forgetPath({ folder: '/x', favourites: [file('/x/a')] }, '/x/a').folder).toBe('/x');
  });
});

describe('withMissing', () => {
  it('flags favourites whose path does not exist', () => {
    const existing = new Set(['/a.md']);
    const result = withMissing([file('/a.md'), folder('/gone')], (p) => existing.has(p));
    expect(result).toEqual([
      { path: '/a.md', kind: 'file', missing: false },
      { path: '/gone', kind: 'folder', missing: true },
    ]);
  });

  it('returns an empty list for no favourites', () => {
    expect(withMissing([], () => true)).toEqual([]);
  });
});
