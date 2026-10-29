// The keyboard-shortcuts table: every command with a shortcut on this platform, grouped by the
// menu it lives in, with the accelerator written the way that platform writes it.
import type { Translate } from '$lib/ports';
import type { CommandId } from './ids';
import type { Command } from './registry';
import { formatAccelerator, resolveAccelerator, type Platform } from './shortcuts';

export interface ShortcutRow {
  readonly id: CommandId;
  /** Translated. */
  readonly label: string;
  /** '⌘⇧S' or 'Ctrl+Shift+S'. */
  readonly keys: string;
}

export interface ShortcutGroup {
  readonly id: string;
  /** Translated. */
  readonly label: string;
  readonly rows: readonly ShortcutRow[];
}

/** Group order and the i18n key of each group's heading. */
const GROUPS = [
  { id: 'file', label: 'menu.file' },
  { id: 'edit', label: 'menu.edit' },
  { id: 'view', label: 'menu.view' },
  { id: 'app', label: 'shortcuts.group.app' },
  { id: 'help', label: 'menu.help' },
] as const;

const groupOf = (id: CommandId): string => id.slice(0, id.indexOf('.'));

function rowOf(command: Command, platform: Platform, t: Translate): ShortcutRow | null {
  const accelerator = command.accelerator && resolveAccelerator(command.accelerator, platform);
  if (!accelerator) return null;
  return {
    id: command.id,
    label: t(command.label),
    keys: formatAccelerator(accelerator, platform),
  };
}

export function shortcutGroups(
  commands: readonly Command[],
  platform: Platform,
  t: Translate,
): ShortcutGroup[] {
  return GROUPS.map(({ id, label }) => ({
    id,
    label: t(label),
    rows: commands
      .filter((command) => groupOf(command.id) === id)
      .map((command) => rowOf(command, platform, t))
      .filter((row) => row !== null),
  })).filter((group) => group.rows.length > 0);
}

const normalise = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim();

/** Keeps the rows whose label contains the query (ignoring case and accents) and drops empty groups. */
export function filterShortcutGroups(
  groups: readonly ShortcutGroup[],
  query: string,
): ShortcutGroup[] {
  const needle = normalise(query);
  if (needle === '') return [...groups];
  return groups
    .map((group) => ({
      ...group,
      rows: group.rows.filter((row) => normalise(row.label).includes(needle)),
    }))
    .filter((group) => group.rows.length > 0);
}
