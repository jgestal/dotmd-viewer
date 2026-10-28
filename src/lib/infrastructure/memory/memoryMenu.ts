import type { AboutInfo, MenuHandlers, MenuNode, NativeMenu } from '../../ports';

/** Keeps the last installed menu, so tests and the browser demo can inspect and trigger it. */
export class MemoryMenu implements NativeMenu {
  menu: readonly MenuNode[] = [];
  about: AboutInfo | null = null;
  handlers: MenuHandlers | null = null;
  installs = 0;

  async install(
    menu: readonly MenuNode[],
    about: AboutInfo,
    handlers: MenuHandlers,
  ): Promise<void> {
    this.menu = menu;
    this.about = about;
    this.handlers = handlers;
    this.installs++;
  }
}
