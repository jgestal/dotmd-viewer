import { describe, expect, it } from 'vitest';
import { fakeTranslate } from '$lib/infrastructure/memory';
import { buildEntryMenu, type EntryMenuContext } from './entryMenu';

const context = (changes: Partial<EntryMenuContext> = {}): EntryMenuContext => ({
  kind: 'file',
  platform: 'mac',
  isFavourite: false,
  renamable: true,
  ...changes,
});

const build = (changes?: Partial<EntryMenuContext>) =>
  buildEntryMenu(context(changes), fakeTranslate);
const ids = (changes?: Partial<EntryMenuContext>) => build(changes).map((item) => item.id);
const labelOf = (id: string, changes?: Partial<EntryMenuContext>) =>
  build(changes).find((item) => item.id === id)?.label;

describe('buildEntryMenu', () => {
  it('lists the actions for a file in order', () => {
    expect(build()).toEqual([
      { id: 'open', label: 'entryMenu.open', separatorBefore: false },
      { id: 'rename', label: 'entryMenu.rename', separatorBefore: false },
      { id: 'trash', label: 'entryMenu.trash', separatorBefore: false },
      { id: 'reveal', label: 'entryMenu.revealMac', separatorBefore: true },
      { id: 'copyPath', label: 'entryMenu.copyPath', separatorBefore: false },
      { id: 'toggleFavourite', label: 'favourites.add', separatorBefore: true },
    ]);
  });

  it('opens a folder as the folder', () => {
    expect(labelOf('open', { kind: 'folder' })).toBe('entryMenu.openFolder');
  });

  it.each([
    ['mac', 'entryMenu.revealMac'],
    ['windows', 'entryMenu.revealWindows'],
    ['linux', 'entryMenu.revealLinux'],
  ] as const)('names the file manager of %s', (platform, label) => {
    expect(labelOf('reveal', { platform })).toBe(label);
  });

  it('offers to remove an item that is already a favourite', () => {
    expect(labelOf('toggleFavourite', { isFavourite: true })).toBe('favourites.remove');
  });

  it('leaves out Rename where the surface cannot rename in place', () => {
    expect(ids({ renamable: false })).toEqual([
      'open',
      'trash',
      'reveal',
      'copyPath',
      'toggleFavourite',
    ]);
  });

  it('keeps only copy path and un-starring for a missing favourite', () => {
    expect(build({ missing: true, isFavourite: true })).toEqual([
      { id: 'copyPath', label: 'entryMenu.copyPath', separatorBefore: false },
      { id: 'toggleFavourite', label: 'favourites.remove', separatorBefore: true },
    ]);
  });
});
