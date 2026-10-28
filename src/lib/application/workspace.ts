// Folder, favourites, recents and file operations (rename, move, trash) over the preferences.
// Every operation takes the current preferences and returns the new ones; nothing is mutated.
// On failure the user is told through the notifier and the preferences come back unchanged.
import { toAppError, type AppError } from '../domain/errors';
import { baseName, dirName, isSameOrInside, isSamePath, joinPath } from '../domain/paths';
import type { Preferences } from '../domain/preferences';
import { addRecent, clearRecents, removeRecent, renameRecent } from '../domain/recents';
import * as rules from '../domain/workspace';
import type { FavouriteWithStatus, Workspace } from '../domain/workspace';
import type { Dialogs, DirEntry, EntryKind, FileSystem, Notifier, Translate } from '../ports';

export interface WorkspaceDeps {
  readonly fs: FileSystem;
  readonly dialogs: Dialogs;
  readonly notifier: Notifier;
  readonly t: Translate;
  readonly caseInsensitive: boolean;
}

/** Where an item went, so the presentation can re-point the open document. */
export interface PathChange {
  readonly from: string;
  readonly to: string;
}

export interface MoveResult {
  readonly prefs: Preferences;
  /** `null` when nothing happened (refused, failed or already there). */
  readonly change: PathChange | null;
}

export interface TrashResult {
  readonly prefs: Preferences;
  readonly trashed: boolean;
}

const FORBIDDEN_NAME_CHARACTERS = /[/\\:*?"<>|]/;

const toWorkspace = (prefs: Preferences): Workspace => ({
  folder: prefs.lastFolder,
  favourites: prefs.favourites,
});

const fromWorkspace = (prefs: Preferences, workspace: Workspace): Preferences => ({
  ...prefs,
  lastFolder: workspace.folder,
  favourites: workspace.favourites,
});

const isValidName = (name: string): boolean =>
  name.trim() !== '' && name !== '.' && name !== '..' && !FORBIDDEN_NAME_CHARACTERS.test(name);

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot) : '';
};

/**
 * Files keep their extension when the new name has none (`notes` becomes `notes.md`); a name
 * that already has one (`notes.txt`) is used as typed. Folders are never touched.
 */
const withKeptExtension = (newName: string, oldName: string, kind: EntryKind): string =>
  kind === 'file' && extensionOf(newName) === '' ? newName + extensionOf(oldName) : newName;

export function createWorkspace({ fs, dialogs, notifier, t, caseInsensitive }: WorkspaceDeps) {
  const sameOrInside = (parent: string, child: string) =>
    isSameOrInside(parent, child, caseInsensitive);

  /** Maps a path through a rename/move with the domain's rule (a workspace folder is just a path). */
  const retarget = (path: string, from: string, to: string): string =>
    rules.renamePath({ folder: path, favourites: [] }, from, to, caseInsensitive).folder as string;

  const retargetRecents = (recents: readonly string[], from: string, to: string) =>
    recents
      .filter((recent) => sameOrInside(from, recent))
      .reduce((list, recent) => renameRecent(list, recent, retarget(recent, from, to)), recents);

  const applyChange = (prefs: Preferences, from: string, to: string): Preferences => ({
    ...fromWorkspace(prefs, rules.renamePath(toWorkspace(prefs), from, to, caseInsensitive)),
    recents: retargetRecents(prefs.recents, from, to),
    lastFile: prefs.lastFile === null ? null : retarget(prefs.lastFile, from, to),
  });

  const applyRemoval = (prefs: Preferences, path: string): Preferences => {
    const forgotten = rules.forgetPath(toWorkspace(prefs), path, caseInsensitive);
    const insideTrashed = forgotten.folder !== null && sameOrInside(path, forgotten.folder);
    return {
      ...fromWorkspace(prefs, insideTrashed ? rules.closeFolder(forgotten) : forgotten),
      recents: prefs.recents
        .filter((recent) => sameOrInside(path, recent))
        .reduce((list, recent) => removeRecent(list, recent), prefs.recents),
      lastFile:
        prefs.lastFile !== null && sameOrInside(path, prefs.lastFile) ? null : prefs.lastFile,
    };
  };

  const describeFailure = (error: AppError, path: string): string => {
    const name = baseName(path);
    switch (error.kind) {
      case 'alreadyExists':
        return t('workspace.alreadyExists', { name });
      case 'notFound':
        return t('workspace.notFound', { name });
      case 'permissionDenied':
        return t('workspace.permissionDenied', { name });
      default:
        return t('workspace.operationFailed', { name, message: error.message });
    }
  };

  /** Runs a file system call; reports a failure to the user and answers whether it worked. */
  const attempt = async (path: string, action: () => Promise<void>): Promise<boolean> => {
    try {
      await action();
      return true;
    } catch (thrown) {
      notifier.error(describeFailure(toAppError(thrown), path));
      return false;
    }
  };

  const relocate = async (prefs: Preferences, from: string, to: string): Promise<MoveResult> =>
    (await attempt(from, () => fs.rename(from, to)))
      ? { prefs: applyChange(prefs, from, to), change: { from, to } }
      : { prefs, change: null };

  const openFolder = async (prefs: Preferences, path: string): Promise<Preferences> => {
    if (!(await fs.exists(path))) {
      notifier.error(t('workspace.folderMissing', { path }));
      return prefs;
    }
    return fromWorkspace(prefs, rules.openFolder(toWorkspace(prefs), path));
  };

  const chooseFolder = async (prefs: Preferences): Promise<Preferences> => {
    const path = await dialogs.openFolder();
    return path === null ? prefs : openFolder(prefs, path);
  };

  const closeFolder = (prefs: Preferences): Preferences =>
    fromWorkspace(prefs, rules.closeFolder(toWorkspace(prefs)));

  const toggleFavourite = (prefs: Preferences, path: string, kind: EntryKind): Preferences =>
    fromWorkspace(
      prefs,
      rules.toggleFavourite(toWorkspace(prefs), { path, kind }, caseInsensitive),
    );

  const isFavourite = (prefs: Preferences, path: string): boolean =>
    rules.isFavourite(toWorkspace(prefs), path, caseInsensitive);

  const removeFavourite = (prefs: Preferences, path: string): Preferences =>
    fromWorkspace(prefs, rules.removeFavourite(toWorkspace(prefs), path, caseInsensitive));

  const moveFavourite = (prefs: Preferences, from: number, to: number): Preferences =>
    fromWorkspace(prefs, rules.moveFavourite(toWorkspace(prefs), from, to));

  const favouritesWithStatus = async (prefs: Preferences): Promise<FavouriteWithStatus[]> => {
    const found = await Promise.all(prefs.favourites.map((fav) => fs.exists(fav.path)));
    const existing = new Set(prefs.favourites.filter((_, i) => found[i]).map((fav) => fav.path));
    return rules.withMissing(prefs.favourites, (path) => existing.has(path));
  };

  const rememberOpened = (prefs: Preferences, path: string): Preferences => ({
    ...prefs,
    recents: addRecent(prefs.recents, path),
    lastFile: path,
  });

  const forgetRecent = (prefs: Preferences, path: string): Preferences => ({
    ...prefs,
    recents: removeRecent(prefs.recents, path),
  });

  const clearAllRecents = (prefs: Preferences): Preferences => ({
    ...prefs,
    recents: clearRecents(),
  });

  /** Lists a folder for the explorer; a folder that cannot be read is reported and shows as empty. */
  const browse = async (path: string): Promise<readonly DirEntry[]> => {
    try {
      return await fs.listDir(path);
    } catch (thrown) {
      notifier.error(describeFailure(toAppError(thrown), path));
      return [];
    }
  };

  /**
   * Renames the item inside its folder. `newName` is a bare name (see `withKeptExtension` for
   * files); `kind` says whether the item is a file or a folder.
   */
  const rename = async (
    prefs: Preferences,
    path: string,
    newName: string,
    kind: EntryKind,
  ): Promise<MoveResult> => {
    if (!isValidName(newName)) {
      notifier.error(t('workspace.invalidName', { name: newName }));
      return { prefs, change: null };
    }
    const target = joinPath(dirName(path), withKeptExtension(newName, baseName(path), kind));
    if (isSamePath(path, target)) return { prefs, change: null };
    return relocate(prefs, path, target);
  };

  /** Moves the item into `targetFolder`, keeping its name. */
  const move = async (
    prefs: Preferences,
    path: string,
    targetFolder: string,
  ): Promise<MoveResult> => {
    if (isSamePath(dirName(path), targetFolder, caseInsensitive)) return { prefs, change: null };
    if (sameOrInside(path, targetFolder)) {
      notifier.error(t('workspace.moveIntoItself', { name: baseName(path) }));
      return { prefs, change: null };
    }
    return relocate(prefs, path, joinPath(targetFolder, baseName(path)));
  };

  /** Asks for confirmation, sends the item to the trash and forgets it everywhere. */
  const trash = async (prefs: Preferences, path: string): Promise<TrashResult> => {
    const confirmed = await dialogs.confirm(
      t('workspace.trashTitle'),
      t('workspace.trashMessage', { name: baseName(path) }),
      t('workspace.trashConfirm'),
      t('workspace.trashCancel'),
    );
    if (!confirmed || !(await attempt(path, () => fs.trash(path)))) {
      return { prefs, trashed: false };
    }
    return { prefs: applyRemoval(prefs, path), trashed: true };
  };

  return {
    openFolder,
    chooseFolder,
    closeFolder,
    isFavourite,
    toggleFavourite,
    removeFavourite,
    moveFavourite,
    favouritesWithStatus,
    browse,
    rememberOpened,
    forgetRecent,
    clearRecents: clearAllRecents,
    rename,
    move,
    trash,
  };
}

export type WorkspaceUseCases = ReturnType<typeof createWorkspace>;
