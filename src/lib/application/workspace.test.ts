import { describe, expect, it } from 'vitest';
import { appError } from '../domain/errors';
import { defaultPreferences, type Preferences } from '../domain/preferences';
import { createMemoryServices } from '../infrastructure/memory';
import { createWorkspace } from './workspace';

const setup = (caseInsensitive = false) => {
  const services = createMemoryServices();
  const workspace = createWorkspace({
    fs: services.fs,
    dialogs: services.dialogs,
    notifier: services.notifier,
    t: services.translate,
    caseInsensitive,
  });
  return { ...services, workspace };
};

const prefsWith = (changes: Partial<Preferences>): Preferences => ({
  ...defaultPreferences,
  ...changes,
});

describe('folder', () => {
  it('opens an existing folder as the last folder', async () => {
    const { workspace, fs } = setup();
    fs.seedFolder('/notes');
    const result = await workspace.openFolder(defaultPreferences, '/notes');
    expect(result).toEqual(prefsWith({ lastFolder: '/notes' }));
  });

  it('keeps the preferences and reports when the folder is missing', async () => {
    const { workspace, notifier } = setup();
    const result = await workspace.openFolder(defaultPreferences, '/gone');
    expect(result).toBe(defaultPreferences);
    expect(notifier.errors).toEqual(['workspace.folderMissing {"path":"/gone"}']);
  });

  it('opens the folder picked in the dialog', async () => {
    const { workspace, fs, dialogs } = setup();
    fs.seedFolder('/picked');
    dialogs.answerOpenFolder('/picked');
    expect((await workspace.chooseFolder(defaultPreferences)).lastFolder).toBe('/picked');
  });

  it('does nothing when the dialog is cancelled', async () => {
    const { workspace, dialogs, notifier } = setup();
    dialogs.answerOpenFolder(null);
    expect(await workspace.chooseFolder(defaultPreferences)).toBe(defaultPreferences);
    expect(notifier.errors).toEqual([]);
  });

  it('closes the folder but remembers the last file', () => {
    const { workspace } = setup();
    const result = workspace.closeFolder(prefsWith({ lastFolder: '/a', lastFile: '/a/x.md' }));
    expect(result).toEqual(prefsWith({ lastFolder: null, lastFile: '/a/x.md' }));
  });
});

describe('browse', () => {
  it('lists the entries of a folder', async () => {
    const { workspace, fs } = setup();
    fs.seedFile('/d/a.md', 'x');
    fs.seedFolder('/d/sub');
    const entries = await workspace.browse('/d');
    expect(entries.map((e) => [e.name, e.kind])).toEqual([
      ['sub', 'folder'],
      ['a.md', 'file'],
    ]);
  });

  it('reports an unreadable folder and shows it as empty', async () => {
    const { workspace, notifier } = setup();
    expect(await workspace.browse('/gone')).toEqual([]);
    expect(notifier.errors).toEqual(['workspace.notFound {"name":"gone"}']);
  });
});

describe('favourites', () => {
  it('adds a favourite and removes it when toggled again', () => {
    const { workspace } = setup();
    const added = workspace.toggleFavourite(defaultPreferences, '/a/x.md', 'file');
    expect(added.favourites).toEqual([{ path: '/a/x.md', kind: 'file' }]);
    expect(workspace.toggleFavourite(added, '/a/x.md', 'file').favourites).toEqual([]);
  });

  it('honours case insensitivity when toggling', () => {
    const { workspace } = setup(true);
    const added = workspace.toggleFavourite(defaultPreferences, '/A/x.md', 'file');
    expect(workspace.toggleFavourite(added, '/a/X.md', 'file').favourites).toEqual([]);
  });

  it('removes a favourite by path', () => {
    const { workspace } = setup();
    const prefs = prefsWith({ favourites: [{ path: '/a', kind: 'folder' }] });
    expect(workspace.removeFavourite(prefs, '/a').favourites).toEqual([]);
  });

  it('reorders favourites', () => {
    const { workspace } = setup();
    const prefs = prefsWith({
      favourites: [
        { path: '/a', kind: 'folder' },
        { path: '/b', kind: 'folder' },
      ],
    });
    expect(workspace.moveFavourite(prefs, 0, 1).favourites.map((f) => f.path)).toEqual([
      '/b',
      '/a',
    ]);
  });

  it('marks favourites whose path no longer exists', async () => {
    const { workspace, fs } = setup();
    fs.seedFile('/a/here.md', '');
    const prefs = prefsWith({
      favourites: [
        { path: '/a/here.md', kind: 'file' },
        { path: '/a/gone.md', kind: 'file' },
      ],
    });
    expect(await workspace.favouritesWithStatus(prefs)).toEqual([
      { path: '/a/here.md', kind: 'file', missing: false },
      { path: '/a/gone.md', kind: 'file', missing: true },
    ]);
  });
});

describe('recents', () => {
  it('puts the opened file first and remembers it as the last file', () => {
    const { workspace } = setup();
    const prefs = prefsWith({ recents: ['/a.md', '/b.md'] });
    const result = workspace.rememberOpened(prefs, '/b.md');
    expect(result.recents).toEqual(['/b.md', '/a.md']);
    expect(result.lastFile).toBe('/b.md');
  });

  it('forgets one recent and clears them all', () => {
    const { workspace } = setup();
    const prefs = prefsWith({ recents: ['/a.md', '/b.md'] });
    expect(workspace.forgetRecent(prefs, '/a.md').recents).toEqual(['/b.md']);
    expect(workspace.clearRecents(prefs).recents).toEqual([]);
  });
});

describe('rename', () => {
  const seeded = () => {
    const env = setup();
    env.fs.seedFile('/a/old.md', '');
    env.fs.seedFile('/a/dir/inner.md', '');
    return env;
  };

  it.each(['', '  ', '.', '..', 'a/b', 'a\\b', 'a:b', 'a*b', 'a?b', 'a"b', 'a<b', 'a>b', 'a|b'])(
    'refuses the invalid name %j',
    async (name) => {
      const { workspace, notifier, fs } = seeded();
      const result = await workspace.rename(defaultPreferences, '/a/old.md', name, 'file');
      expect(result).toEqual({ prefs: defaultPreferences, change: null });
      expect(notifier.errors).toEqual([`workspace.invalidName ${JSON.stringify({ name })}`]);
      expect(fs.calls).toEqual([]);
    },
  );

  it('keeps the extension of a file when the new name has none', async () => {
    const { workspace } = seeded();
    const result = await workspace.rename(defaultPreferences, '/a/old.md', 'new', 'file');
    expect(result.change).toEqual({ from: '/a/old.md', to: '/a/new.md' });
  });

  it('uses the extension typed by the user', async () => {
    const { workspace } = seeded();
    const result = await workspace.rename(defaultPreferences, '/a/old.md', 'new.txt', 'file');
    expect(result.change).toEqual({ from: '/a/old.md', to: '/a/new.txt' });
  });

  it('adds no extension to a file that had none', async () => {
    const { workspace, fs } = setup();
    fs.seedFile('/a/README', '');
    const result = await workspace.rename(defaultPreferences, '/a/README', 'NOTES', 'file');
    expect(result.change?.to).toBe('/a/NOTES');
  });

  it('does not append an extension to folders', async () => {
    const { workspace } = seeded();
    const result = await workspace.rename(defaultPreferences, '/a/dir', 'v1', 'folder');
    expect(result.change).toEqual({ from: '/a/dir', to: '/a/v1' });
  });

  it('is a no-op when the name does not change', async () => {
    const { workspace, fs } = seeded();
    const result = await workspace.rename(defaultPreferences, '/a/old.md', 'old', 'file');
    expect(result).toEqual({ prefs: defaultPreferences, change: null });
    expect(fs.calls).toEqual([]);
  });

  it('re-points favourites, recents, last folder and last file', async () => {
    const { workspace } = seeded();
    const prefs = prefsWith({
      favourites: [
        { path: '/a/dir', kind: 'folder' },
        { path: '/a/dir/inner.md', kind: 'file' },
        { path: '/a/old.md', kind: 'file' },
      ],
      recents: ['/a/dir/inner.md', '/other.md'],
      lastFolder: '/a/dir',
      lastFile: '/a/dir/inner.md',
    });
    const result = await workspace.rename(prefs, '/a/dir', 'renamed', 'folder');
    expect(result.prefs).toEqual(
      prefsWith({
        favourites: [
          { path: '/a/renamed', kind: 'folder' },
          { path: '/a/renamed/inner.md', kind: 'file' },
          { path: '/a/old.md', kind: 'file' },
        ],
        recents: ['/a/renamed/inner.md', '/other.md'],
        lastFolder: '/a/renamed',
        lastFile: '/a/renamed/inner.md',
      }),
    );
  });

  it('leaves unrelated preferences and a null last file alone', async () => {
    const { workspace } = seeded();
    const prefs = prefsWith({ recents: ['/other.md'], lastFolder: '/elsewhere' });
    const result = await workspace.rename(prefs, '/a/old.md', 'new', 'file');
    expect(result.prefs).toEqual(prefs);
  });

  it('reports a name clash in translated form and keeps the preferences', async () => {
    const { workspace, notifier, fs } = seeded();
    fs.seedFile('/a/taken.md', '');
    const prefs = prefsWith({ lastFile: '/a/old.md' });
    const result = await workspace.rename(prefs, '/a/old.md', 'taken', 'file');
    expect(result).toEqual({ prefs, change: null });
    expect(notifier.errors).toEqual(['workspace.alreadyExists {"name":"old.md"}']);
  });
});

describe('failure messages', () => {
  const failRename = async (error: unknown) => {
    const { workspace, notifier, fs } = setup();
    fs.seedFile('/a/x.md', '');
    fs.rename = () => Promise.reject(error);
    await workspace.rename(defaultPreferences, '/a/x.md', 'y', 'file');
    return notifier.errors;
  };

  it('translates notFound', async () => {
    expect(await failRename(appError('notFound', 'x'))).toEqual([
      'workspace.notFound {"name":"x.md"}',
    ]);
  });

  it('translates permissionDenied', async () => {
    expect(await failRename(appError('permissionDenied', 'x'))).toEqual([
      'workspace.permissionDenied {"name":"x.md"}',
    ]);
  });

  it('passes the message of any other failure along', async () => {
    expect(await failRename(new Error('boom'))).toEqual([
      'workspace.operationFailed {"name":"x.md","message":"boom"}',
    ]);
  });
});

describe('move', () => {
  const seeded = (caseInsensitive = false) => {
    const env = setup(caseInsensitive);
    env.fs.seedFile('/a/x.md', '');
    env.fs.seedFile('/a/dir/inner.md', '');
    env.fs.seedFolder('/b');
    return env;
  };

  it('moves a file into another folder and updates the preferences', async () => {
    const { workspace, fs } = seeded();
    const prefs = prefsWith({
      favourites: [{ path: '/a/x.md', kind: 'file' }],
      recents: ['/a/x.md'],
      lastFile: '/a/x.md',
    });
    const result = await workspace.move(prefs, '/a/x.md', '/b');
    expect(result.change).toEqual({ from: '/a/x.md', to: '/b/x.md' });
    expect(result.prefs).toEqual(
      prefsWith({
        favourites: [{ path: '/b/x.md', kind: 'file' }],
        recents: ['/b/x.md'],
        lastFile: '/b/x.md',
      }),
    );
    expect(await fs.exists('/b/x.md')).toBe(true);
  });

  it('is a silent no-op when the target is the current parent', async () => {
    const { workspace, notifier, fs } = seeded();
    const result = await workspace.move(defaultPreferences, '/a/x.md', '/a/');
    expect(result).toEqual({ prefs: defaultPreferences, change: null });
    expect(notifier.errors).toEqual([]);
    expect(fs.calls).toEqual([]);
  });

  it('compares parents case-insensitively when asked to', async () => {
    const { workspace, fs } = seeded(true);
    const result = await workspace.move(defaultPreferences, '/a/x.md', '/A');
    expect(result.change).toBeNull();
    expect(fs.calls).toEqual([]);
  });

  it.each(['/a/dir', '/a/dir/sub'])(
    'refuses to move a folder into itself or a descendant (%s)',
    async (target) => {
      const { workspace, notifier, fs } = seeded();
      const result = await workspace.move(defaultPreferences, '/a/dir', target);
      expect(result).toEqual({ prefs: defaultPreferences, change: null });
      expect(notifier.errors).toEqual(['workspace.moveIntoItself {"name":"dir"}']);
      expect(fs.calls).toEqual([]);
    },
  );

  it('reports a clash in the target folder', async () => {
    const { workspace, notifier, fs } = seeded();
    fs.seedFile('/b/x.md', '');
    const result = await workspace.move(defaultPreferences, '/a/x.md', '/b');
    expect(result.change).toBeNull();
    expect(notifier.errors).toEqual(['workspace.alreadyExists {"name":"x.md"}']);
  });
});

describe('trash', () => {
  const seeded = () => {
    const env = setup();
    env.fs.seedFile('/a/dir/inner.md', '');
    env.fs.seedFile('/a/keep.md', '');
    return env;
  };

  it('asks for confirmation with translated texts', async () => {
    const { workspace, dialogs } = seeded();
    dialogs.answerConfirm(false);
    await workspace.trash(defaultPreferences, '/a/dir');
    expect(dialogs.calls).toEqual([
      {
        method: 'confirm',
        args: [
          'workspace.trashTitle',
          'workspace.trashMessage {"name":"dir"}',
          'workspace.trashConfirm',
          'workspace.trashCancel',
        ],
      },
    ]);
  });

  it('does nothing when the user declines', async () => {
    const { workspace, dialogs, fs } = seeded();
    dialogs.answerConfirm(false);
    const result = await workspace.trash(defaultPreferences, '/a/dir');
    expect(result).toEqual({ prefs: defaultPreferences, trashed: false });
    expect(fs.trashed).toEqual([]);
  });

  it('trashes the item and forgets it everywhere, including what it contained', async () => {
    const { workspace, dialogs, fs } = seeded();
    dialogs.answerConfirm(true);
    const prefs = prefsWith({
      favourites: [
        { path: '/a/dir/inner.md', kind: 'file' },
        { path: '/a/keep.md', kind: 'file' },
      ],
      recents: ['/a/dir/inner.md', '/a/keep.md'],
      lastFolder: '/a/dir',
      lastFile: '/a/dir/inner.md',
    });
    const result = await workspace.trash(prefs, '/a/dir');
    expect(result.trashed).toBe(true);
    expect(result.prefs).toEqual(
      prefsWith({
        favourites: [{ path: '/a/keep.md', kind: 'file' }],
        recents: ['/a/keep.md'],
        lastFolder: null,
        lastFile: null,
      }),
    );
    expect(fs.trashed).toEqual(['/a/dir']);
  });

  it('keeps an unrelated folder and last file', async () => {
    const { workspace, dialogs } = seeded();
    dialogs.answerConfirm(true);
    const prefs = prefsWith({ lastFolder: '/a', lastFile: '/a/keep.md' });
    expect((await workspace.trash(prefs, '/a/dir')).prefs).toEqual(prefs);
  });

  it('keeps a null last file and last folder', async () => {
    const { workspace, dialogs } = seeded();
    dialogs.answerConfirm(true);
    expect((await workspace.trash(defaultPreferences, '/a/dir')).prefs).toEqual(defaultPreferences);
  });

  it('reports a failure and keeps the preferences', async () => {
    const { workspace, dialogs, notifier, fs } = seeded();
    dialogs.answerConfirm(true);
    fs.failNext('trash', appError('permissionDenied', 'no'));
    const prefs = prefsWith({ recents: ['/a/dir/inner.md'] });
    const result = await workspace.trash(prefs, '/a/dir');
    expect(result).toEqual({ prefs, trashed: false });
    expect(notifier.errors).toEqual(['workspace.permissionDenied {"name":"dir"}']);
  });
});
