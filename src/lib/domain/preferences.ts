// User preferences: defaults, tolerant parsing of stored values and validated updates.
import { MAX_RECENTS } from './recents';

export interface Favourite {
  readonly path: string;
  readonly kind: 'file' | 'folder';
}

export interface Preferences {
  readonly language: 'system' | 'en' | 'es';
  readonly theme: 'system' | 'light' | 'dark';
  readonly editMode: 'preview' | 'code' | 'split';
  readonly layout: 'continuous' | 'pages' | 'slides';
  readonly pageSize: 'a4' | 'letter';
  /** 0.5 to 3 in steps of 0.1. */
  readonly zoom: number;
  readonly sidebarVisible: boolean;
  readonly sidebarTab: 'explorer' | 'favourites' | 'outline';
  /** Pixels, 180 to 600. */
  readonly sidebarWidth: number;
  readonly recents: readonly string[];
  readonly favourites: readonly Favourite[];
  readonly lastFolder: string | null;
  readonly lastFile: string | null;
}

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.1;
export const SIDEBAR_WIDTH_MIN = 180;
export const SIDEBAR_WIDTH_MAX = 600;

export const defaultPreferences: Preferences = {
  language: 'system',
  theme: 'system',
  editMode: 'preview',
  layout: 'continuous',
  pageSize: 'a4',
  zoom: 1,
  sidebarVisible: true,
  sidebarTab: 'explorer',
  sidebarWidth: 260,
  recents: [],
  favourites: [],
  lastFolder: null,
  lastFile: null,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const roundToTenth = (value: number): number => Math.round(value * 10) / 10;

const clampZoom = (zoom: number): number => roundToTenth(clamp(zoom, ZOOM_MIN, ZOOM_MAX));

export const zoomIn = (zoom: number): number => clampZoom(zoom + ZOOM_STEP);
export const zoomOut = (zoom: number): number => clampZoom(zoom - ZOOM_STEP);
export const resetZoom = (): number => defaultPreferences.zoom;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPath = (value: unknown): value is string => typeof value === 'string' && value !== '';

const oneOf =
  <T extends string>(options: readonly T[], fallback: T) =>
  (raw: unknown): T =>
    options.find((option) => option === raw) ?? fallback;

const boundedNumber =
  (min: number, max: number, fallback: number, normalise: (n: number) => number) =>
  (raw: unknown): number =>
    typeof raw === 'number' && !Number.isNaN(raw) ? normalise(clamp(raw, min, max)) : fallback;

const parseFavourite = (raw: unknown): Favourite | null =>
  isRecord(raw) && isPath(raw.path) && (raw.kind === 'file' || raw.kind === 'folder')
    ? { path: raw.path, kind: raw.kind }
    : null;

type FieldParsers = { readonly [K in keyof Preferences]: (raw: unknown) => Preferences[K] };

const fieldParsers: FieldParsers = {
  language: oneOf(['system', 'en', 'es'], defaultPreferences.language),
  theme: oneOf(['system', 'light', 'dark'], defaultPreferences.theme),
  editMode: oneOf(['preview', 'code', 'split'], defaultPreferences.editMode),
  layout: oneOf(['continuous', 'pages', 'slides'], defaultPreferences.layout),
  pageSize: oneOf(['a4', 'letter'], defaultPreferences.pageSize),
  zoom: boundedNumber(ZOOM_MIN, ZOOM_MAX, defaultPreferences.zoom, roundToTenth),
  sidebarVisible: (raw) => (typeof raw === 'boolean' ? raw : defaultPreferences.sidebarVisible),
  sidebarTab: oneOf(['explorer', 'favourites', 'outline'], defaultPreferences.sidebarTab),
  sidebarWidth: boundedNumber(
    SIDEBAR_WIDTH_MIN,
    SIDEBAR_WIDTH_MAX,
    defaultPreferences.sidebarWidth,
    Math.round,
  ),
  recents: (raw) =>
    Array.isArray(raw)
      ? [...new Set(raw.filter(isPath))].slice(0, MAX_RECENTS)
      : defaultPreferences.recents,
  favourites: (raw) =>
    Array.isArray(raw)
      ? raw.map(parseFavourite).filter((favourite) => favourite !== null)
      : defaultPreferences.favourites,
  lastFolder: (raw) => (isPath(raw) ? raw : null),
  lastFile: (raw) => (isPath(raw) ? raw : null),
};

const preferenceKeys = Object.keys(fieldParsers) as (keyof Preferences)[];

/** Reads stored preferences of any shape; every invalid field falls back to its default. */
export const parsePreferences = (raw: unknown): Preferences => {
  const source = isRecord(raw) ? raw : {};
  const entries = preferenceKeys.map((key) => [key, fieldParsers[key](source[key])]);
  return Object.fromEntries(entries) as unknown as Preferences;
};

/** Pretty JSON with the fields always in declaration order. */
export const serialisePreferences = (preferences: Preferences): string => {
  const ordered = preferenceKeys.map((key) => [key, preferences[key]]);
  return JSON.stringify(Object.fromEntries(ordered), null, 2) + '\n';
};

/** Returns `preferences` with one field replaced; an invalid value resets that field to default. */
export const updatePreference = <K extends keyof Preferences>(
  preferences: Preferences,
  key: K,
  value: Preferences[K],
): Preferences => ({ ...preferences, [key]: fieldParsers[key](value) });
