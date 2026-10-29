import { describe, expect, it } from 'vitest';
import type { App } from './app.svelte';
import { createAppCommands } from './appCommands';

const commandsFor = (document: object | null) =>
  createAppCommands({ document, preferences: {} } as unknown as App);

const find = (commands: ReturnType<typeof commandsFor>, id: string) =>
  commands.find((command) => command.id === id);

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
