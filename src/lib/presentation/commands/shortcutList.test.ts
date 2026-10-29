import { describe, expect, it } from 'vitest';
import type { Command } from './registry';
import { filterShortcutGroups, shortcutGroups } from './shortcutList';

const t = (key: string): string => `<${key}>`;
const run = () => {};

const commands: Command[] = [
  { id: 'file.saveAs', label: 'menu.saveAs', accelerator: 'Mod+Shift+S', run },
  { id: 'file.save', label: 'menu.save', accelerator: 'Mod+S', run },
  { id: 'file.close', label: 'menu.close', run },
  {
    id: 'view.fullScreen',
    label: 'menu.fullScreen',
    accelerator: { mac: 'Ctrl+Mod+F', other: 'F11' },
    run,
  },
  { id: 'app.settings', label: 'menu.settings', accelerator: 'Mod+,', run },
  {
    id: 'app.quit',
    label: 'menu.quit',
    accelerator: { mac: 'Mod+Q', other: 'Mod+Q', windows: null },
    run,
  },
  { id: 'help.shortcuts', label: 'menu.keyboardShortcuts', run },
];

describe('shortcutGroups', () => {
  it('groups by menu section in menu order, keeping registry order inside', () => {
    const groups = shortcutGroups(commands, 'mac', t);
    expect(groups.map((group) => group.id)).toEqual(['file', 'view', 'app']);
    expect(groups[0].label).toBe('<menu.file>');
    expect(groups[0].rows.map((row) => row.id)).toEqual(['file.saveAs', 'file.save']);
  });

  it('writes accelerators the macOS way', () => {
    const [file, view, app] = shortcutGroups(commands, 'mac', t);
    expect(file.rows[0]).toEqual({ id: 'file.saveAs', label: '<menu.saveAs>', keys: '⌘⇧S' });
    expect(view.rows[0].keys).toBe('⌃⌘F');
    expect(app.rows.map((row) => row.keys)).toEqual(['⌘,', '⌘Q']);
  });

  it('writes accelerators the Windows and Linux way', () => {
    const [file, view] = shortcutGroups(commands, 'linux', t);
    expect(file.rows[0].keys).toBe('Ctrl+Shift+S');
    expect(view.rows[0].keys).toBe('F11');
  });

  it('leaves out commands without a shortcut on that platform', () => {
    const windows = shortcutGroups(commands, 'windows', t);
    const ids = windows.flatMap((group) => group.rows.map((row) => row.id));
    expect(ids).not.toContain('app.quit');
    expect(ids).not.toContain('file.close');
    expect(ids).not.toContain('help.shortcuts');
  });

  it('returns nothing for an empty registry', () => {
    expect(shortcutGroups([], 'mac', t)).toEqual([]);
  });
});

describe('filterShortcutGroups', () => {
  const spanish: Record<string, string> = {
    'menu.saveAs': 'Guardar como…',
    'menu.save': 'Guardar',
    'menu.settings': 'Ajustes…',
  };
  const groups = shortcutGroups(commands, 'mac', (key) => spanish[key] ?? key);

  it('returns every group for a blank query', () => {
    expect(filterShortcutGroups(groups, '  ')).toEqual(groups);
  });

  it('keeps matching rows and drops empty groups', () => {
    const result = filterShortcutGroups(groups, 'guard');
    expect(result.map((group) => group.id)).toEqual(['file']);
    expect(result[0].rows.map((row) => row.id)).toEqual(['file.saveAs', 'file.save']);
  });

  it('ignores case and accents', () => {
    const rows = filterShortcutGroups(groups, 'GUARDÁR COMO')[0].rows;
    expect(rows.map((row) => row.id)).toEqual(['file.saveAs']);
  });

  it('finds nothing when no label matches', () => {
    expect(filterShortcutGroups(groups, 'zzz')).toEqual([]);
  });
});
