import { describe, expect, it, vi } from 'vitest';
import { MemoryMenu } from '$lib/infrastructure/memory';
import { createRegistry } from '../commands/registry';
import { ABOUT, createMenuInstaller, currentMenu } from './nativeMenu';
import type { MenuNode } from './menuModel';

const t = (key: string) => key;

const find = (tree: readonly MenuNode[], id: string): MenuNode | undefined => {
  for (const node of tree) {
    if (node.kind === 'command' && node.id === id) return node;
    if (node.kind === 'submenu') {
      const found = find(node.items, id);
      if (found) return found;
    }
  }
  return undefined;
};

describe('currentMenu', () => {
  const commands = createRegistry([
    {
      id: 'file.save',
      label: 'menu.save',
      accelerator: 'Mod+S',
      run: () => {},
      enabled: () => false,
    },
    {
      id: 'view.fullScreen',
      label: 'menu.fullScreen',
      accelerator: { mac: 'Ctrl+Mod+F', other: 'F11' },
      run: () => {},
      checked: () => true,
    },
  ]);

  it('takes accelerators in Tauri syntax and the live enabled/checked state', () => {
    const tree = currentMenu({ platform: 'windows', t, recents: [], commands });
    expect(find(tree, 'file.save')).toMatchObject({
      accelerator: 'CmdOrCtrl+S',
      enabled: false,
    });
    expect(find(tree, 'view.fullScreen')).toMatchObject({
      accelerator: 'F11',
      enabled: true,
      checked: true,
    });
  });

  it('disables commands that are not registered', () => {
    const tree = currentMenu({ platform: 'linux', t, recents: [], commands });
    expect(find(tree, 'file.exportPdf')).toMatchObject({ enabled: false, accelerator: undefined });
  });
});

describe('createMenuInstaller', () => {
  const tree: MenuNode[] = [{ kind: 'command', id: 'file.new', label: 'New', enabled: true }];

  it('installs with the about info and forwards menu actions', async () => {
    const menu = new MemoryMenu();
    const onCommand = vi.fn();
    const onRecent = vi.fn();
    await createMenuInstaller(menu, { onCommand, onRecent })(tree);
    expect(menu.about).toBe(ABOUT);
    menu.handlers?.onCommand('file.new');
    menu.handlers?.onRecent('/a.md');
    expect(onCommand).toHaveBeenCalledWith('file.new');
    expect(onRecent).toHaveBeenCalledWith('/a.md');
  });

  it('skips a rebuild when nothing changed', async () => {
    const menu = new MemoryMenu();
    const install = createMenuInstaller(menu, { onCommand: vi.fn(), onRecent: vi.fn() });
    await install(tree);
    await install(structuredClone(tree));
    expect(menu.installs).toBe(1);
    await install([{ ...tree[0], enabled: false } as MenuNode]);
    expect(menu.installs).toBe(2);
  });
});
