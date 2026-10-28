import { describe, expect, it } from 'vitest';
import { addRecent, clearRecents, MAX_RECENTS, removeRecent, renameRecent } from './recents';

describe('addRecent', () => {
  it('puts a new path first', () => {
    expect(addRecent(['/a.md'], '/b.md')).toEqual(['/b.md', '/a.md']);
  });

  it('starts a list from empty', () => {
    expect(addRecent([], '/a.md')).toEqual(['/a.md']);
  });

  it('moves an existing path to the front without duplicating it', () => {
    expect(addRecent(['/a.md', '/b.md', '/c.md'], '/c.md')).toEqual(['/c.md', '/a.md', '/b.md']);
  });

  it('keeps at most ten entries by default', () => {
    const full = Array.from({ length: 10 }, (_, i) => `/f${i}.md`);
    const next = addRecent(full, '/new.md');
    expect(MAX_RECENTS).toBe(10);
    expect(next).toHaveLength(10);
    expect(next[0]).toBe('/new.md');
    expect(next[9]).toBe('/f8.md');
  });

  it('honours a custom maximum', () => {
    expect(addRecent(['/a', '/b', '/c'], '/d', 2)).toEqual(['/d', '/a']);
  });

  it('treats backslashes and slashes as the same separator', () => {
    expect(addRecent(['C:\\docs\\a.md', '/b.md'], 'C:/docs/a.md')).toEqual([
      'C:/docs/a.md',
      '/b.md',
    ]);
  });

  it('ignores a trailing slash when comparing', () => {
    expect(addRecent(['/docs/', '/b'], '/docs')).toEqual(['/docs', '/b']);
    expect(addRecent(['/docs\\', '/b'], '/docs')).toEqual(['/docs', '/b']);
  });

  it('keeps Unicode paths intact', () => {
    expect(addRecent(['/notas/año.md'], '/notas/日本.md')).toEqual([
      '/notas/日本.md',
      '/notas/año.md',
    ]);
  });

  it('does not mutate the input', () => {
    const list = ['/a'];
    addRecent(list, '/b');
    expect(list).toEqual(['/a']);
  });
});

describe('removeRecent', () => {
  it('removes the path, comparing normalised', () => {
    expect(removeRecent(['/a', 'C:\\b\\', '/c'], 'C:/b')).toEqual(['/a', '/c']);
  });

  it('leaves the list alone when the path is absent', () => {
    expect(removeRecent(['/a'], '/z')).toEqual(['/a']);
  });
});

describe('clearRecents', () => {
  it('returns an empty list', () => {
    expect(clearRecents()).toEqual([]);
  });
});

describe('renameRecent', () => {
  it('renames in place', () => {
    expect(renameRecent(['/a', '/b', '/c'], '/b', '/x')).toEqual(['/a', '/x', '/c']);
  });

  it('matches the old path regardless of separator style', () => {
    expect(renameRecent(['C:\\a.md'], 'C:/a.md', 'C:/b.md')).toEqual(['C:/b.md']);
  });

  it('collapses duplicates when the new path was already listed', () => {
    expect(renameRecent(['/a', '/b', '/c'], '/c', '/a')).toEqual(['/a', '/b']);
  });

  it('leaves the list alone when the old path is absent', () => {
    expect(renameRecent(['/a'], '/z', '/y')).toEqual(['/a']);
  });
});
