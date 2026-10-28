// Loading, saving and updating the user preferences through the store port.
import {
  defaultPreferences,
  parsePreferences,
  serialisePreferences,
  updatePreference,
} from '../domain/preferences';
import type { Preferences } from '../domain/preferences';
import type { Notifier, PreferencesStore, Translate } from '../ports';

export interface PreferencesDeps {
  readonly store: PreferencesStore;
  readonly notifier: Notifier;
  readonly t: Translate;
}

export interface PreferencesUseCases {
  /** Stored preferences with invalid fields defaulted; defaults plus one error when the store fails. */
  load(): Promise<Preferences>;
  /** Writes immediately; the presentation decides how often to call it. */
  save(preferences: Preferences): Promise<void>;
  /** Replaces one validated field, saves, and returns the new preferences. */
  update<K extends keyof Preferences>(
    preferences: Preferences,
    key: K,
    value: Preferences[K],
  ): Promise<Preferences>;
}

export function createPreferences({ store, notifier, t }: PreferencesDeps): PreferencesUseCases {
  const load = async (): Promise<Preferences> => {
    try {
      return parsePreferences(await store.load());
    } catch {
      notifier.error(t('preferences.loadFailed'));
      return defaultPreferences;
    }
  };

  const save = async (preferences: Preferences): Promise<void> => {
    try {
      await store.save(serialisePreferences(preferences));
    } catch {
      notifier.error(t('preferences.saveFailed'));
    }
  };

  const update = async <K extends keyof Preferences>(
    preferences: Preferences,
    key: K,
    value: Preferences[K],
  ): Promise<Preferences> => {
    const updated = updatePreference(preferences, key, value);
    await save(updated);
    return updated;
  };

  return { load, save, update };
}
