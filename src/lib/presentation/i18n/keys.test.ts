// Translation keys: every key the code can request exists in both dictionaries, every key is
// requested by something, and the two languages agree on what a translator can easily break.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { EntryKind } from '$lib/ports';
import type { App } from '../app.svelte';
import { createAppCommands, editModes, layouts, sidebarTabs } from '../appCommands';
import type { Platform } from '../commands/shortcuts';
import { buildEntryMenu } from '../contextMenu/entryMenu';
import { buildMenu, type MenuNode } from '../menu/menuModel';
import { languageOptions, pageSizeOptions, themeOptions } from '../settingsOptions';
import { en } from './en';
import { es } from './es';

const SRC = path.resolve(import.meta.dirname, '..', '..', '..');
const DICTIONARY_FILE = /i18n\/(en|es)\.ts$/;
const SOURCE_FILE = /\.(ts|svelte)$/;
const TEST_CODE = /\.test\.ts$/;
const CALLED_KEY = /\bt\(\s*['"]([^'"]+)['"]/g;

const PLATFORMS: readonly Platform[] = ['mac', 'windows', 'linux'];
const ENTRY_KINDS: readonly EntryKind[] = ['file', 'folder'];
const FLAGS = [true, false] as const;

const english: Readonly<Record<string, string>> = en;
const spanish: Readonly<Record<string, string>> = es;

interface SourceFile {
  readonly file: string;
  readonly content: string;
}

const listFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });

const sourceFiles = (): SourceFile[] =>
  listFiles(SRC)
    .filter(
      (file) => SOURCE_FILE.test(file) && !TEST_CODE.test(file) && !DICTIONARY_FILE.test(file),
    )
    .map((file) => ({ file, content: fs.readFileSync(file, 'utf8') }));

/** Keys passed literally to `t(...)` or `i18n.t(...)`. */
const calledKeys = (sources: readonly SourceFile[]): string[] =>
  sources.flatMap(({ content }) => [...content.matchAll(CALLED_KEY)].map((match) => match[1]));

/** Keys the code builds at run time from a list in the source, enumerated from that list. */
const familyKeys = (): string[] => [
  ...editModes.map((mode) => `mode.${mode}`),
  ...layouts.map((layout) => `layout.${layout}`),
  ...sidebarTabs.map((tab) => `sidebar.${tab}`),
  ...pageSizeOptions.map((option) => `pages.size.${option.value}`),
];

const commandLabels = (): string[] => createAppCommands({} as App).map((command) => command.label);

const optionLabels = (): string[] =>
  [...languageOptions, ...themeOptions, ...pageSizeOptions].map((option) => option.label);

const identity = (key: string): string => key;

/** Every label of a menu tree, with the Windows and Linux mnemonics removed. */
const labelsOf = (nodes: readonly MenuNode[]): string[] =>
  nodes.flatMap((node) => {
    if (node.kind === 'submenu') return [node.label, ...labelsOf(node.items)];
    return node.kind === 'command' || node.kind === 'predefined' ? [node.label] : [];
  });

const menuLabels = (): string[] =>
  PLATFORMS.flatMap((platform) =>
    labelsOf(buildMenu({ platform, t: identity, recents: [], command: () => ({ enabled: true }) })),
  ).map((label) => label.replaceAll('&', ''));

const entryMenuLabels = (): string[] =>
  PLATFORMS.flatMap((platform) =>
    ENTRY_KINDS.flatMap((kind) =>
      FLAGS.flatMap((isFavourite) =>
        FLAGS.flatMap((missing) =>
          FLAGS.flatMap((renamable) =>
            buildEntryMenu({ kind, platform, isFavourite, missing, renamable }, identity).map(
              (item) => item.label,
            ),
          ),
        ),
      ),
    ),
  );

/** Every key the code can request, found by reading the sources and enumerating the lists. */
const requestedKeys = (sources: readonly SourceFile[]): Set<string> =>
  new Set([
    ...calledKeys(sources),
    ...familyKeys(),
    ...commandLabels(),
    ...optionLabels(),
    ...menuLabels(),
    ...entryMenuLabels(),
  ]);

const isMentioned = (key: string, sources: readonly SourceFile[]): boolean =>
  sources.some(
    ({ content }) =>
      content.includes(`'${key}'`) ||
      content.includes(`"${key}"`) ||
      content.includes(`\`${key}\``),
  );

const sources = sourceFiles();
const requested = requestedKeys(sources);
const dictionaryKeys = Object.keys(en);

describe('translation keys the code requests', () => {
  it('are found by the scan', () => {
    expect(calledKeys(sources)).toContain('document.untitled');
    expect(requested).toContain('mode.split');
    expect(requested).toContain('menu.quit');
  });

  it.each([
    ['English', english],
    ['Spanish', spanish],
  ])('all exist in the %s dictionary', (_, dictionary) => {
    const missing = [...requested].filter((key) => !Object.hasOwn(dictionary, key));
    expect(missing).toEqual([]);
  });
});

describe('dictionary keys', () => {
  it('are all requested by the code', () => {
    const unused = dictionaryKeys.filter(
      (key) => !requested.has(key) && !isMentioned(key, sources),
    );
    expect(unused).toEqual([]);
  });
});

describe('dictionary values', () => {
  it.each([
    ['English', english],
    ['Spanish', spanish],
  ])('are not empty and not the key itself in %s', (_, dictionary) => {
    const broken = Object.entries(dictionary)
      .filter(([key, value]) => value.trim() === '' || value === key)
      .map(([key]) => key);
    expect(broken).toEqual([]);
  });

  it('use the ellipsis in both languages or in neither', () => {
    const mismatched = dictionaryKeys.filter(
      (key) => english[key].endsWith('…') !== spanish[key].endsWith('…'),
    );
    expect(mismatched).toEqual([]);
  });

  it('use «» quotes in Spanish, never straight quotes', () => {
    const straight = dictionaryKeys.filter((key) => spanish[key].includes('"'));
    expect(straight).toEqual([]);
  });
});
