// Every translation key used in the sources must exist in the dictionaries.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { en } from './en';

const LIB = path.resolve(import.meta.dirname, '..', '..');
const SCANNED = ['application', 'presentation'];
const SOURCE_FILE = /\.(ts|svelte)$/;
const TEST_CODE = /\.test\.ts$/;
const KEY_USAGE = /\bt\(\s*'([^']+)'/g;

const listFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });

const usedKeys = (): Map<string, string> => {
  const keys = new Map<string, string>();
  for (const folder of SCANNED) {
    for (const file of listFiles(path.join(LIB, folder))) {
      if (!SOURCE_FILE.test(file) || TEST_CODE.test(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      for (const match of content.matchAll(KEY_USAGE)) keys.set(match[1], file);
    }
  }
  return keys;
};

describe('translation keys used in the sources', () => {
  const keys = usedKeys();

  it('are found by the scan', () => expect(keys.has('document.untitled')).toBe(true));

  it('all exist in the English dictionary', () => {
    const missing = [...keys]
      .filter(([key]) => !(key in en))
      .map(([key, file]) => `${key} (${file})`);
    expect(missing).toEqual([]);
  });
});
