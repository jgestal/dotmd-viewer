import { describe, expect, it } from 'vitest';
import type { CommandId } from '../commands/ids';
import type { Platform } from '../commands/shortcuts';
import { buildMenu, withMnemonics, type CommandState, type MenuNode } from './menuModel';

const t = (key: string) => `[${key}]`;

const context = (
  platform: Platform,
  overrides: Partial<Record<CommandId, CommandState>> = {},
  recents: readonly string[] = [],
) => ({
  platform,
  t,
  recents,
  command: (id: CommandId) => overrides[id] ?? { enabled: true },
});

const strip = (label: string) => label.replaceAll('&', '');
const titles = (menu: readonly MenuNode[]) =>
  menu.map((node) => (node.kind === 'submenu' ? strip(node.label) : node.kind));
const submenu = (menu: readonly MenuNode[], key: string) => {
  const found = menu.find((node) => node.kind === 'submenu' && strip(node.label) === `[${key}]`);
  if (found?.kind !== 'submenu') throw new Error(`no submenu ${key}`);
  return found.items;
};
const labels = (items: readonly MenuNode[]) =>
  items.map((node) =>
    node.kind === 'separator'
      ? '—'
      : node.kind === 'predefined'
        ? `<${node.item}>`
        : strip(node.label),
  );

describe('buildMenu', () => {
  it('gives macOS an app menu and a Window menu', () => {
    expect(titles(buildMenu(context('mac')))).toEqual([
      '[app.name]',
      '[menu.file]',
      '[menu.edit]',
      '[menu.view]',
      '[menu.window]',
      '[menu.help]',
    ]);
    const app = submenu(buildMenu(context('mac')), 'app.name');
    expect(labels(app)).toEqual([
      '[menu.about]',
      '—',
      '[menu.settings]',
      '—',
      '<services>',
      '—',
      '<hide>',
      '<hideOthers>',
      '<showAll>',
      '—',
      '[menu.quit]',
    ]);
  });

  it.each(['windows', 'linux'] as const)('gives %s no app or Window menu', (platform) => {
    expect(titles(buildMenu(context(platform)))).toEqual([
      '[menu.file]',
      '[menu.edit]',
      '[menu.view]',
      '[menu.help]',
    ]);
  });

  it('puts Settings and Exit in File on Windows', () => {
    const file = labels(submenu(buildMenu(context('windows')), 'menu.file'));
    expect(file.slice(-4)).toEqual(['—', '[menu.settings]', '—', '[menu.exit]']);
    const quit = submenu(buildMenu(context('windows')), 'menu.file').at(-1);
    expect(quit).toMatchObject({ kind: 'command', id: 'app.quit' });
    expect(strip(quit?.kind === 'command' ? quit.label : '')).toBe('[menu.exit]');
  });

  it('puts Preferences at the end of Edit and Quit in File on Linux', () => {
    const menu = buildMenu(context('linux'));
    expect(labels(submenu(menu, 'menu.edit')).slice(-2)).toEqual(['—', '[menu.preferences]']);
    const quit = submenu(menu, 'menu.file').at(-1);
    expect(quit).toMatchObject({ kind: 'command', id: 'app.quit' });
    expect(strip(quit?.kind === 'command' ? quit.label : '')).toBe('[menu.quit]');
  });

  it('uses the app command, never the system item, for Quit on every platform', () => {
    const app = submenu(buildMenu(context('mac')), 'app.name').at(-1);
    expect(app).toMatchObject({ kind: 'command', id: 'app.quit', label: '[menu.quit]' });
    const flat = JSON.stringify(buildMenu(context('linux')));
    expect(flat).not.toContain('"item":"quit"');
  });

  it.each(['linux', 'windows'] as const)(
    'ends Help with the app About dialog command on %s',
    (platform) => {
      const about = submenu(buildMenu(context(platform)), 'menu.help').at(-1);
      expect(about).toMatchObject({ kind: 'command', id: 'help.about' });
      expect(strip((about as { label: string }).label)).toBe('[menu.about]');
      expect(JSON.stringify(buildMenu(context(platform)))).not.toContain('"item":"about"');
    },
  );

  it('opens the app About dialog from the macOS app menu, not from Help', () => {
    const app = submenu(buildMenu(context('mac')), 'app.name');
    expect(app[0]).toMatchObject({ kind: 'command', id: 'help.about' });
    expect(JSON.stringify(buildMenu(context('mac')))).not.toContain('"item":"about"');
    const flat = JSON.stringify(submenu(buildMenu(context('mac')), 'menu.help'));
    expect(flat).not.toContain('help.about');
  });

  it.each(['mac', 'linux', 'windows'] as const)(
    'starts Help with the user guide on %s',
    (platform) => {
      const first = submenu(buildMenu(context(platform)), 'menu.help')[0];
      expect(first).toMatchObject({ kind: 'command', id: 'help.guide' });
    },
  );

  it('uses the system full-screen item on macOS and the app command elsewhere', () => {
    expect(labels(submenu(buildMenu(context('mac')), 'menu.view')).at(-1)).toBe('<fullscreen>');
    expect(submenu(buildMenu(context('windows')), 'menu.view').at(-1)).toMatchObject({
      kind: 'command',
      id: 'view.fullScreen',
    });
  });

  it('offers the themes as a View submenu of checkable items followed by Next Theme', () => {
    const menu = buildMenu(
      context('linux', { 'view.theme.sepia': { enabled: true, checked: true } }),
    );
    const theme = submenu(submenu(menu, 'menu.view'), 'menu.theme');
    expect(labels(theme)).toEqual([
      '[settings.system]',
      '[settings.theme.light]',
      '[settings.theme.dark]',
      '[settings.theme.sepia]',
      '[settings.theme.night]',
      '—',
      '[menu.nextTheme]',
    ]);
    expect(theme.map((node) => (node.kind === 'command' ? node.id : null))).toEqual([
      'view.theme.system',
      'view.theme.light',
      'view.theme.dark',
      'view.theme.sepia',
      'view.theme.night',
      null,
      'view.theme.next',
    ]);
    expect(theme[3]).toMatchObject({ checked: true });
  });

  it('copies accelerator, enabled and checked from the command state', () => {
    const menu = buildMenu(
      context('mac', {
        'file.save': { accelerator: 'Mod+S', enabled: false },
        'view.toggleSidebar': { enabled: true, checked: true },
      }),
    );
    const file = submenu(menu, 'menu.file');
    expect(file.find((n) => n.kind === 'command' && n.id === 'file.save')).toEqual({
      kind: 'command',
      id: 'file.save',
      label: '[menu.save]',
      accelerator: 'Mod+S',
      enabled: false,
    });
    const view = submenu(menu, 'menu.view');
    expect(view.find((n) => n.kind === 'command' && n.id === 'view.toggleSidebar')).toMatchObject({
      checked: true,
    });
  });

  it('shows commands whose feature is missing as disabled', () => {
    const menu = buildMenu({ ...context('mac'), command: () => undefined });
    const file = submenu(menu, 'menu.file');
    expect(file.find((n) => n.kind === 'command' && n.id === 'file.exportPdf')).toMatchObject({
      enabled: false,
    });
  });

  it('lists recent files by name, then Clear Recents', () => {
    const recent = submenu(
      submenu(buildMenu(context('mac', {}, ['/a/one.md', 'C:\\b\\two.md'])), 'menu.file'),
      'menu.openRecent',
    );
    expect(recent).toEqual([
      { kind: 'recent', path: '/a/one.md', label: 'one.md' },
      { kind: 'recent', path: 'C:\\b\\two.md', label: 'two.md' },
      { kind: 'separator' },
      expect.objectContaining({ id: 'file.clearRecents' }),
    ]);
  });

  it('has only Clear Recents when there are no recents', () => {
    const recent = submenu(submenu(buildMenu(context('mac')), 'menu.file'), 'menu.openRecent');
    expect(labels(recent)).toEqual(['[menu.clearRecents]']);
  });

  it('adds mnemonics on Windows and Linux only', () => {
    expect(buildMenu(context('windows'))[0]).toMatchObject({ label: '[&menu.file]' });
    expect(buildMenu(context('mac'))[1]).toMatchObject({ label: '[menu.file]' });
  });
});

describe('withMnemonics', () => {
  const item = (label: string): MenuNode => ({
    kind: 'command',
    id: 'file.new',
    label,
    enabled: true,
  });
  const out = (nodes: readonly MenuNode[]) =>
    withMnemonics(nodes).map((node) => ('label' in node ? node.label : node.kind));

  it('picks the first letter not taken at the same level', () => {
    expect(out([item('Archivo'), item('Edición'), item('Ver'), item('Ayuda')])).toEqual([
      '&Archivo',
      '&Edición',
      '&Ver',
      'A&yuda',
    ]);
  });

  it('is case-insensitive and skips spaces and punctuation', () => {
    expect(out([item('Save'), item('save as…'), item('… (x)')])).toEqual([
      '&Save',
      's&ave as…',
      '… (&x)',
    ]);
  });

  it('escapes literal ampersands', () => {
    expect(out([item('Find & Replace')])).toEqual(['&Find && Replace']);
  });

  it('leaves the label alone when every letter is taken', () => {
    expect(out([item('ab'), item('ba'), item('ab')])).toEqual(['&ab', '&ba', 'ab']);
  });

  it('restarts the letters inside each submenu and ignores other nodes', () => {
    const nodes: MenuNode[] = [
      { kind: 'submenu', label: 'File', items: [item('Find'), { kind: 'separator' }] },
      { kind: 'separator' },
      { kind: 'predefined', item: 'copy', label: 'Copy' },
    ];
    expect(withMnemonics(nodes)).toEqual([
      { kind: 'submenu', label: '&File', items: [{ ...item('&Find') }, { kind: 'separator' }] },
      { kind: 'separator' },
      { kind: 'predefined', item: 'copy', label: 'Copy' },
    ]);
  });
});
