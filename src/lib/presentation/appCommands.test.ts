import { describe, expect, it, vi } from 'vitest';
import type { App } from './app.svelte';
import { createAppCommands } from './appCommands';

const commandsFor = (document: object | null) =>
  createAppCommands({ document, preferences: {} } as unknown as App);

const find = (commands: ReturnType<typeof commandsFor>, id: string) =>
  commands.find((command) => command.id === id);

describe('help commands', () => {
  it('opens the user guide', () => {
    const openGuide = vi.fn();
    const commands = createAppCommands({
      document: null,
      preferences: {},
      openGuide,
    } as unknown as App);
    find(commands, 'help.guide')?.run();
    expect(openGuide).toHaveBeenCalledOnce();
  });

  it("opens the author's website in the system browser", () => {
    const openExternal = vi.fn();
    const app = { document: null, preferences: {}, openExternal } as unknown as App;
    find(createAppCommands(app), 'help.website')?.run();
    expect(openExternal).toHaveBeenCalledWith('https://gestal.es');
  });
});

describe('paper commands', () => {
  it.each(['file.exportPdf', 'file.print'])('binds %s to its default shortcut', (id) => {
    const command = find(commandsFor(null), id);
    expect(command?.accelerator).toBe(id === 'file.print' ? 'Mod+P' : 'Mod+Shift+E');
  });

  it.each(['file.exportPdf', 'file.print'])('%s needs an open document', (id) => {
    expect(find(commandsFor(null), id)?.enabled?.()).toBe(false);
    expect(find(commandsFor({}), id)?.enabled?.()).toBe(true);
  });
});
