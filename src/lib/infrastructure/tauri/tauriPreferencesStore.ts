import type { PreferencesStore } from '../../ports';
import { call } from './invoke';

/** The preferences JSON file in the app config directory (preferences_file.rs). */
export const tauriPreferencesStore: PreferencesStore = {
  load: () => call<unknown>('load_preferences'),
  save: (serialised) => call<void>('save_preferences', { serialised }),
};
