import type { PreferencesStore } from '../../ports';

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/** Keeps the preferences "file" in memory: `raw` is what `load` returns, `saved` every text written. */
export class MemoryPreferencesStore implements PreferencesStore {
  readonly saved: string[] = [];

  constructor(public raw: unknown = null) {}

  async load(): Promise<unknown> {
    return this.raw;
  }

  /** Stores the text and makes it the next thing `load` returns (parsed, as the JSON file would be). */
  async save(serialised: string): Promise<void> {
    this.saved.push(serialised);
    this.raw = parseJson(serialised);
  }
}
