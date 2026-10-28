import { describe, expect, it } from 'vitest';
import { favouriteLabel, reorderTarget } from './favouriteLabel';

describe('favouriteLabel', () => {
  it('splits a file path into name and parent folder', () => {
    expect(favouriteLabel('/demo/notes/Ideas.md')).toEqual({
      name: 'Ideas.md',
      parent: '/demo/notes',
    });
  });

  it('treats Windows separators like slashes', () => {
    expect(favouriteLabel('C:\\docs\\a.md')).toEqual({ name: 'a.md', parent: 'C:/docs' });
  });

  it('ignores a trailing slash on folders', () => {
    expect(favouriteLabel('/demo/notes/')).toEqual({ name: 'notes', parent: '/demo' });
  });

  it('keeps Unicode names intact', () => {
    expect(favouriteLabel('/demo/日本語/ñandú.md').name).toBe('ñandú.md');
  });

  it('shows a root as its own name with no parent', () => {
    expect(favouriteLabel('/')).toEqual({ name: '/', parent: '' });
  });
});

describe('reorderTarget', () => {
  it('moves up and down by one', () => {
    expect(reorderTarget('ArrowUp', 3)).toBe(2);
    expect(reorderTarget('ArrowDown', 3)).toBe(4);
  });

  it('ignores any other key', () => {
    expect(reorderTarget('Enter', 3)).toBeNull();
  });
});
