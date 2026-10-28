import { describe, expect, it } from 'vitest';
import { appError } from '../domain/errors';
import { defaultPreferences, serialisePreferences } from '../domain/preferences';
import { createMemoryServices } from '../infrastructure/memory';
import { createPreferences } from './preferences';

const setup = () => {
  const services = createMemoryServices();
  const useCases = createPreferences({
    store: services.preferences,
    notifier: services.notifier,
    t: services.translate,
  });
  return { ...services, useCases };
};

describe('load', () => {
  it('returns the defaults when nothing was stored yet', async () => {
    const { useCases, notifier } = setup();
    expect(await useCases.load()).toEqual(defaultPreferences);
    expect(notifier.errors).toEqual([]);
  });

  it('parses stored values and defaults the invalid fields', async () => {
    const { useCases, preferences } = setup();
    preferences.raw = { theme: 'dark', zoom: 'big', lastFolder: '/notes' };
    expect(await useCases.load()).toEqual({
      ...defaultPreferences,
      theme: 'dark',
      lastFolder: '/notes',
    });
  });

  it('falls back to the defaults and reports once when the store rejects', async () => {
    const { useCases, preferences, notifier } = setup();
    preferences.load = () => Promise.reject(appError('io', 'disk gone'));
    expect(await useCases.load()).toEqual(defaultPreferences);
    expect(notifier.errors).toEqual(['preferences.loadFailed']);
  });
});

describe('save', () => {
  it('writes the serialised preferences immediately', async () => {
    const { useCases, preferences } = setup();
    const changed = { ...defaultPreferences, theme: 'light' as const };
    await useCases.save(changed);
    expect(preferences.saved).toEqual([serialisePreferences(changed)]);
  });

  it('reports a failed write instead of throwing', async () => {
    const { useCases, preferences, notifier } = setup();
    preferences.save = () => Promise.reject(appError('permissionDenied', 'read only'));
    await expect(useCases.save(defaultPreferences)).resolves.toBeUndefined();
    expect(notifier.errors).toEqual(['preferences.saveFailed']);
  });
});

describe('update', () => {
  it('changes one field, saves and returns the new preferences', async () => {
    const { useCases, preferences } = setup();
    const updated = await useCases.update(defaultPreferences, 'zoom', 1.5);
    expect(updated).toEqual({ ...defaultPreferences, zoom: 1.5 });
    expect(preferences.saved).toEqual([serialisePreferences(updated)]);
  });

  it('clamps an out-of-range value as the domain does', async () => {
    const { useCases } = setup();
    const updated = await useCases.update(defaultPreferences, 'zoom', 99);
    expect(updated.zoom).toBe(3);
  });
});
