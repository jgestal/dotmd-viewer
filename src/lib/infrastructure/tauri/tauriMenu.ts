import { getVersion } from '@tauri-apps/api/app';
import {
  CheckMenuItem,
  Menu,
  MenuItem,
  PredefinedMenuItem,
  Submenu,
  type MenuItemOptions,
} from '@tauri-apps/api/menu';
import type {
  AboutInfo,
  MenuHandlers,
  MenuNode,
  NativeMenu,
  PredefinedMenuItem as Predefined,
} from '../../ports';
import { attempt } from './invoke';
import { runsOnMac } from './windowTitle';

type TauriPredefined = Exclude<Parameters<typeof PredefinedMenuItem.new>[0], undefined>['item'];
type Built = Submenu | MenuItem | CheckMenuItem | PredefinedMenuItem;

const PREDEFINED: Readonly<Record<Exclude<Predefined, 'about'>, TauriPredefined>> = {
  undo: 'Undo',
  redo: 'Redo',
  cut: 'Cut',
  copy: 'Copy',
  paste: 'Paste',
  selectAll: 'SelectAll',
  minimize: 'Minimize',
  maximize: 'Maximize',
  fullscreen: 'Fullscreen',
  bringAllToFront: 'BringAllToFront',
  services: 'Services',
  hide: 'Hide',
  hideOthers: 'HideOthers',
  showAll: 'ShowAll',
  quit: 'Quit',
};

/**
 * Builds the menu bar from the app's menu tree and installs it: as the app menu on macOS, as
 * the window's menu bar on Windows and Linux. Each install replaces (and frees) the previous one.
 */
export class TauriMenu implements NativeMenu {
  #current: Menu | null = null;
  #version: Promise<string> | null = null;

  async install(menu: readonly MenuNode[], about: AboutInfo, handlers: MenuHandlers) {
    this.#version ??= getVersion().catch(() => '');
    const version = await this.#version;
    const build = (node: MenuNode): Promise<Built> =>
      buildNode(node, { about, version, handlers, build });
    const next = await attempt(async () => Menu.new({ items: await Promise.all(menu.map(build)) }));
    await attempt(() => (runsOnMac() ? next.setAsAppMenu() : next.setAsWindowMenu()));
    const previous = this.#current;
    this.#current = next;
    await previous?.close();
  }
}

interface BuildContext {
  readonly about: AboutInfo;
  readonly version: string;
  readonly handlers: MenuHandlers;
  readonly build: (node: MenuNode) => Promise<Built>;
}

async function buildNode(node: MenuNode, context: BuildContext): Promise<Built> {
  const { handlers } = context;
  switch (node.kind) {
    case 'submenu':
      return Submenu.new({
        text: node.label,
        items: await Promise.all(node.items.map(context.build)),
      });
    case 'command': {
      const options: MenuItemOptions = {
        id: node.id,
        text: node.label,
        enabled: node.enabled,
        accelerator: node.accelerator,
        action: () => handlers.onCommand(node.id),
      };
      return node.checked === undefined
        ? MenuItem.new(options)
        : CheckMenuItem.new({ ...options, checked: node.checked });
    }
    case 'recent':
      return MenuItem.new({ text: node.label, action: () => handlers.onRecent(node.path) });
    case 'separator':
      return PredefinedMenuItem.new({ item: 'Separator' });
    case 'predefined':
      if (node.item === 'about') {
        const { about, version } = context;
        return PredefinedMenuItem.new({
          text: node.label,
          item: {
            About: {
              name: about.name,
              version,
              credits: about.credits,
              website: about.website,
              websiteLabel: about.website.replace(/^https?:\/\//, ''),
              copyright: about.copyright,
              authors: [about.credits],
            },
          },
        });
      }
      return PredefinedMenuItem.new({ item: PREDEFINED[node.item], text: node.label });
  }
}
