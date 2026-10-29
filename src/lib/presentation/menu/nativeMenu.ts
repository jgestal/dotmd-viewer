// Keeps the native menu bar in step with the app: it is rebuilt whenever a label, a recent file
// or a command's enabled/checked state changes (the effect in +page tracks those reads).
import type { AboutInfo, NativeMenu } from '$lib/ports';
import type { CommandId } from '../commands/ids';
import type { CommandRegistry } from '../commands/registry';
import { resolveAccelerator, toTauriAccelerator, type Platform } from '../commands/shortcuts';
import type { Translate } from '$lib/ports';
import { buildMenu, type MenuNode } from './menuModel';

export const ABOUT: AboutInfo = {
  name: 'SimpleDotMD',
  credits: 'Juan Gestal · juan@gestal.es',
  website: 'https://gestal.es',
  copyright: '© 2026 Juan Gestal · MIT License',
};

export interface MenuSource {
  readonly platform: Platform;
  readonly t: Translate;
  readonly recents: readonly string[];
  readonly commands: CommandRegistry;
}

/** The menu tree for the current state; reading it inside an effect subscribes to that state. */
export function currentMenu({ platform, t, recents, commands }: MenuSource): MenuNode[] {
  return buildMenu({
    platform,
    t,
    recents,
    command: (id: CommandId) => {
      const command = commands.get(id);
      if (!command) return undefined;
      const accelerator = command.accelerator && resolveAccelerator(command.accelerator, platform);
      return {
        accelerator: accelerator ? toTauriAccelerator(accelerator) : undefined,
        enabled: command.enabled?.() ?? true,
        checked: command.checked?.(),
      };
    },
  });
}

/** Installs a menu tree, skipping identical rebuilds (labels and states unchanged). */
export function createMenuInstaller(
  menu: NativeMenu,
  handlers: { onCommand(id: CommandId): void; onRecent(path: string): void },
) {
  let installed = '';
  return async (tree: readonly MenuNode[]): Promise<void> => {
    const signature = JSON.stringify(tree);
    if (signature === installed) return;
    installed = signature;
    await menu.install(tree, ABOUT, {
      onCommand: (id) => handlers.onCommand(id as CommandId),
      onRecent: (path) => handlers.onRecent(path),
    });
  };
}
