import { describe, expect, it } from 'vitest';
import {
  defaultPreferences,
  parsePreferences,
  resetZoom,
  serialisePreferences,
  updatePreference,
  zoomIn,
  zoomOut,
  type Preferences,
} from './preferences';

const custom: Preferences = {
  language: 'es',
  theme: 'dark',
  editMode: 'split',
  layout: 'slides',
  pageSize: 'letter',
  zoom: 1.7,
  sidebarVisible: false,
  sidebarTab: 'outline',
  sidebarWidth: 333,
  recents: ['/a.md', '/b.md'],
  favourites: [
    { path: '/docs', kind: 'folder' },
    { path: '/a.md', kind: 'file' },
  ],
  lastFolder: '/docs',
  lastFile: '/a.md',
  guideShown: true,
};

describe('defaultPreferences', () => {
  it('has the documented values', () => {
    expect(defaultPreferences).toEqual({
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
      guideShown: false,
    });
  });
});

describe('parsePreferences', () => {
  it.each([null, undefined, 'text', 42, true, [], [1, 2], () => 1, NaN])(
    'returns defaults for non-object input %p',
    (raw) => {
      expect(parsePreferences(raw)).toEqual(defaultPreferences);
    },
  );

  it('returns defaults for an empty object', () => {
    expect(parsePreferences({})).toEqual(defaultPreferences);
  });

  it('accepts a fully valid object', () => {
    expect(parsePreferences(custom)).toEqual(custom);
  });

  it('ignores extra keys', () => {
    const parsed = parsePreferences({ ...custom, hacker: 1, nested: { a: [] } });
    expect(parsed).toEqual(custom);
    expect(Object.keys(parsed)).not.toContain('hacker');
  });

  it('replaces only the invalid fields', () => {
    expect(parsePreferences({ ...custom, theme: 'neon', zoom: 'big', language: 5 })).toEqual({
      ...custom,
      theme: 'system',
      zoom: 1,
      language: 'system',
    });
  });

  it.each([
    ['language', 'fr'],
    ['theme', null],
    ['editMode', 'edit'],
    ['layout', {}],
    ['pageSize', 'a3'],
    ['sidebarTab', ['explorer']],
    ['sidebarVisible', 'yes'],
    ['sidebarVisible', 1],
    ['sidebarWidth', '300'],
    ['zoom', '2'],
    ['zoom', NaN],
    ['recents', 'a.md'],
    ['recents', { 0: 'a' }],
    ['favourites', 'x'],
    ['favourites', null],
    ['lastFolder', 7],
    ['lastFolder', ''],
    ['lastFile', []],
    ['lastFile', ''],
  ] as const)('falls back to the default when %s is %p', (key, value) => {
    expect(parsePreferences({ ...custom, [key]: value })[key]).toEqual(
      key === 'lastFolder' || key === 'lastFile' ? null : defaultPreferences[key],
    );
  });

  it.each(['system', 'light', 'dark', 'sepia', 'night'] as const)(
    'accepts the %s theme',
    (theme) => {
      expect(parsePreferences({ theme }).theme).toBe(theme);
    },
  );

  it.each([
    ['language', 'system'],
    ['language', 'en'],
    ['language', 'es'],
    ['editMode', 'preview'],
    ['editMode', 'code'],
    ['editMode', 'split'],
    ['layout', 'continuous'],
    ['layout', 'pages'],
    ['layout', 'slides'],
    ['pageSize', 'a4'],
    ['pageSize', 'letter'],
    ['sidebarTab', 'explorer'],
    ['sidebarTab', 'favourites'],
    ['sidebarTab', 'outline'],
  ] as const)('accepts %s %j', (key, value) => {
    expect(parsePreferences({ ...custom, [key]: value })[key]).toBe(value);
  });

  it.each(['language', 'editMode', 'layout', 'pageSize', 'sidebarTab'] as const)(
    'rejects an empty %s',
    (key) => {
      expect(parsePreferences({ ...custom, [key]: '' })[key]).toBe(defaultPreferences[key]);
    },
  );

  it('is case sensitive for enumerations', () => {
    expect(parsePreferences({ theme: 'Dark' }).theme).toBe('system');
  });

  it.each([
    [0, 0.5],
    [-5, 0.5],
    [0.49, 0.5],
    [10, 3],
    [Infinity, 3],
    [-Infinity, 0.5],
    [1.26, 1.3],
    [2.04, 2],
  ])('clamps and rounds zoom %p to %p', (zoom, expected) => {
    expect(parsePreferences({ zoom }).zoom).toBe(expected);
  });

  it.each([
    [0, 180],
    [179, 180],
    [180, 180],
    [600, 600],
    [601, 600],
    [99999, 600],
    [-1, 180],
    [Infinity, 600],
    [250.6, 251],
  ])('clamps sidebar width %p to %p', (sidebarWidth, expected) => {
    expect(parsePreferences({ sidebarWidth }).sidebarWidth).toBe(expected);
  });

  it('keeps NaN widths at the default', () => {
    expect(parsePreferences({ sidebarWidth: NaN }).sidebarWidth).toBe(260);
  });

  it('drops invalid recents entries and duplicates', () => {
    const raw = ['/a', 7, null, '', '/a', { x: 1 }, ['/b'], '/b'];
    expect(parsePreferences({ recents: raw }).recents).toEqual(['/a', '/b']);
  });

  it('caps recents at ten', () => {
    const raw = Array.from({ length: 25 }, (_, i) => `/f${i}`);
    const { recents } = parsePreferences({ recents: raw });
    expect(recents).toHaveLength(10);
    expect(recents[0]).toBe('/f0');
    expect(recents[9]).toBe('/f9');
  });

  it('drops invalid favourites and strips extra fields', () => {
    const raw = [
      { path: '/ok', kind: 'file' },
      { path: '/dir', kind: 'folder', extra: true },
      { path: '/bad', kind: 'link' },
      { path: '', kind: 'file' },
      { path: 5, kind: 'file' },
      { kind: 'file' },
      { path: '/nokind' },
      null,
      'str',
      [],
      42,
    ];
    expect(parsePreferences({ favourites: raw }).favourites).toEqual([
      { path: '/ok', kind: 'file' },
      { path: '/dir', kind: 'folder' },
    ]);
  });

  it('survives deeply nested garbage', () => {
    const garbage = { a: [{ b: [[[{}]]] }], c: { d: { e: null } } };
    const raw = Object.fromEntries(Object.keys(defaultPreferences).map((key) => [key, garbage]));
    expect(parsePreferences(raw)).toEqual(defaultPreferences);
  });

  it('survives arrays of garbage in every field', () => {
    const raw = Object.fromEntries(
      Object.keys(defaultPreferences).map((key) => [key, [1, [], {}]]),
    );
    expect(parsePreferences(raw)).toEqual({ ...defaultPreferences });
  });

  it('does not share references with the input', () => {
    const recents = ['/a'];
    const parsed = parsePreferences({ recents });
    expect(parsed.recents).not.toBe(recents);
  });
});

describe('serialisePreferences', () => {
  it('writes stable pretty JSON ending in a newline', () => {
    const text = serialisePreferences(defaultPreferences);
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toContain('\n  "language": "system",\n  "theme": "system",');
  });

  it('is independent of property order', () => {
    const shuffled = Object.fromEntries(Object.entries(custom).reverse()) as unknown as Preferences;
    expect(serialisePreferences(shuffled)).toBe(serialisePreferences(custom));
  });

  it('keeps favourites contents', () => {
    expect(serialisePreferences(custom)).toContain('"kind": "folder"');
  });

  it.each([defaultPreferences, custom])('round-trips through parsePreferences', (p) => {
    expect(parsePreferences(JSON.parse(serialisePreferences(p)))).toEqual(p);
  });
});

describe('updatePreference', () => {
  it('returns a new object with the field changed', () => {
    const next = updatePreference(defaultPreferences, 'theme', 'dark');
    expect(next).toEqual({ ...defaultPreferences, theme: 'dark' });
    expect(next).not.toBe(defaultPreferences);
    expect(defaultPreferences.theme).toBe('system');
  });

  it('clamps numeric values', () => {
    expect(updatePreference(defaultPreferences, 'zoom', 9).zoom).toBe(3);
    expect(updatePreference(defaultPreferences, 'sidebarWidth', 10).sidebarWidth).toBe(180);
  });

  it('resets an invalid value to the default of that field', () => {
    const base = updatePreference(defaultPreferences, 'layout', 'pages');
    const next = updatePreference(base, 'layout', 'bogus' as Preferences['layout']);
    expect(next.layout).toBe('continuous');
  });

  it('validates list fields', () => {
    const next = updatePreference(defaultPreferences, 'recents', ['/a', '/a', ''] as string[]);
    expect(next.recents).toEqual(['/a']);
  });

  it('accepts null for last folder and file', () => {
    expect(updatePreference(custom, 'lastFile', null).lastFile).toBeNull();
    expect(updatePreference(custom, 'lastFolder', null).lastFolder).toBeNull();
  });
});

describe('zoom helpers', () => {
  it('zooms in by one tenth', () => {
    expect(zoomIn(1)).toBe(1.1);
  });

  it('zooms out by one tenth', () => {
    expect(zoomOut(1)).toBe(0.9);
  });

  it('avoids floating point drift', () => {
    expect(zoomIn(0.7)).toBe(0.8);
    expect(zoomIn(1.1)).toBe(1.2);
    expect(zoomOut(0.8)).toBe(0.7);
    let zoom = 1;
    for (let i = 0; i < 10; i++) zoom = zoomIn(zoom);
    expect(zoom).toBe(2);
  });

  it('clamps at the limits', () => {
    expect(zoomIn(3)).toBe(3);
    expect(zoomOut(0.5)).toBe(0.5);
    expect(zoomIn(2.95)).toBe(3);
    expect(zoomOut(0.55)).toBe(0.5);
  });

  it('resets to 1', () => {
    expect(resetZoom()).toBe(1);
  });
});
