import { describe, expect, it } from 'vitest';
import { fakeTranslate } from '$lib/infrastructure/memory';
import type { MenuItem } from '$lib/ports';
import {
  buildCodeMenu,
  buildPreviewMenu,
  buildTitleMenu,
  type DocumentMenuContext,
  type PreviewMenuContext,
  type TitleMenuContext,
} from './documentMenu';

const preview = (changes: Partial<PreviewMenuContext> = {}) =>
  buildPreviewMenu(
    { platform: 'mac', hasPath: true, hasSelection: true, editing: false, ...changes },
    fakeTranslate,
  );
const code = (changes: Partial<DocumentMenuContext> = {}) =>
  buildCodeMenu({ platform: 'mac', hasPath: true, hasSelection: true, ...changes }, fakeTranslate);
const title = (changes: Partial<TitleMenuContext> = {}) =>
  buildTitleMenu({ platform: 'mac', hasPath: true, inOpenFolder: true, ...changes }, fakeTranslate);
const ids = (items: readonly MenuItem[]) => items.map((item) => item.id);
const find = (items: readonly MenuItem[], id: string) => items.find((item) => item.id === id);

describe('buildPreviewMenu', () => {
  it('lists the actions of the reading views in order', () => {
    expect(preview()).toEqual([
      { id: 'copy', label: 'menu.copy', enabled: true, separatorBefore: false },
      { id: 'selectAll', label: 'menu.selectAll', enabled: true, separatorBefore: false },
      { id: 'toggleEdit', label: 'action.edit', enabled: true, separatorBefore: true },
      { id: 'exportPdf', label: 'menu.exportPdf', enabled: true, separatorBefore: false },
      { id: 'print', label: 'menu.print', enabled: true, separatorBefore: false },
      { id: 'reveal', label: 'entryMenu.revealMac', enabled: true, separatorBefore: true },
      { id: 'copyPath', label: 'entryMenu.copyPath', enabled: true, separatorBefore: false },
    ]);
  });

  it('enables Copy only with a selection', () => {
    expect(find(preview({ hasSelection: false }), 'copy')?.enabled).toBe(false);
  });

  it('disables Reveal and Copy Path for an unsaved document', () => {
    const items = preview({ hasPath: false });
    expect(find(items, 'reveal')?.enabled).toBe(false);
    expect(find(items, 'copyPath')?.enabled).toBe(false);
  });

  it.each([
    ['mac', 'entryMenu.revealMac'],
    ['windows', 'entryMenu.revealWindows'],
    ['linux', 'entryMenu.revealLinux'],
  ] as const)('names the file manager of %s', (platform, label) => {
    expect(find(preview({ platform }), 'reveal')?.label).toBe(label);
  });

  it('adds the link actions after the clipboard, behind a separator', () => {
    const items = preview({ link: true });
    expect(ids(items).slice(0, 4)).toEqual(['copy', 'selectAll', 'openLink', 'copyLink']);
    expect(find(items, 'openLink')?.separatorBefore).toBe(true);
    expect(find(items, 'copyLink')?.separatorBefore).toBe(false);
  });

  it('adds Copy Image Address for an image', () => {
    const items = preview({ image: true });
    expect(ids(items).slice(0, 3)).toEqual(['copy', 'selectAll', 'copyImage']);
    expect(find(items, 'copyImage')?.separatorBefore).toBe(true);
  });

  it('offers a linked image both sets of actions', () => {
    expect(ids(preview({ link: true, image: true })).slice(2, 5)).toEqual([
      'openLink',
      'copyLink',
      'copyImage',
    ]);
  });

  it('leads with Cut, Copy, Paste and Select All while editing, and offers to stop', () => {
    const items = preview({ editing: true });
    expect(ids(items).slice(0, 4)).toEqual(['cut', 'copy', 'paste', 'selectAll']);
    expect(find(items, 'toggleEdit')?.label).toBe('action.stopEditing');
  });

  it('enables Cut only with a selection while editing, and Paste always', () => {
    const items = preview({ editing: true, hasSelection: false });
    expect(find(items, 'cut')?.enabled).toBe(false);
    expect(find(items, 'paste')?.enabled).toBe(true);
  });
});

describe('buildCodeMenu', () => {
  it('lists clipboard, Find, then export and print', () => {
    expect(code()).toEqual([
      { id: 'cut', label: 'menu.cut', enabled: true, separatorBefore: false },
      { id: 'copy', label: 'menu.copy', enabled: true, separatorBefore: false },
      { id: 'paste', label: 'menu.paste', enabled: true, separatorBefore: false },
      { id: 'selectAll', label: 'menu.selectAll', enabled: true, separatorBefore: false },
      { id: 'find', label: 'menu.find', enabled: true, separatorBefore: true },
      { id: 'exportPdf', label: 'menu.exportPdf', enabled: true, separatorBefore: true },
      { id: 'print', label: 'menu.print', enabled: true, separatorBefore: false },
    ]);
  });

  it('disables Cut and Copy without a selection', () => {
    const items = code({ hasSelection: false });
    expect(find(items, 'cut')?.enabled).toBe(false);
    expect(find(items, 'copy')?.enabled).toBe(false);
    expect(find(items, 'paste')?.enabled).toBe(true);
  });
});

describe('buildTitleMenu', () => {
  it('lists reveal, copy path and show in sidebar', () => {
    expect(title()).toEqual([
      { id: 'reveal', label: 'entryMenu.revealMac', enabled: true, separatorBefore: false },
      { id: 'copyPath', label: 'entryMenu.copyPath', enabled: true, separatorBefore: false },
      {
        id: 'showInSidebar',
        label: 'documentMenu.showInSidebar',
        enabled: true,
        separatorBefore: true,
      },
    ]);
  });

  it('disables everything for an unsaved document', () => {
    expect(title({ hasPath: false, inOpenFolder: false }).map((item) => item.enabled)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('disables Show in Sidebar when the file is outside the open folder', () => {
    const items = title({ inOpenFolder: false });
    expect(find(items, 'showInSidebar')?.enabled).toBe(false);
    expect(find(items, 'reveal')?.enabled).toBe(true);
  });

  it('names the file manager of the platform', () => {
    expect(find(title({ platform: 'linux' }), 'reveal')?.label).toBe('entryMenu.revealLinux');
  });
});
