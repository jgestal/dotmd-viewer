import { isSameOrInside, isSamePath, joinPath, normalisePath } from './paths';

export interface Favourite {
  readonly path: string;
  readonly kind: 'file' | 'folder';
}

export interface Workspace {
  readonly folder: string | null;
  readonly favourites: readonly Favourite[];
}

export type FavouriteWithStatus = Favourite & { missing: boolean };

export const emptyWorkspace: Workspace = { folder: null, favourites: [] };

export const openFolder = (workspace: Workspace, path: string): Workspace => ({
  ...workspace,
  folder: path,
});

export const closeFolder = (workspace: Workspace): Workspace => ({ ...workspace, folder: null });

export function isFavourite(workspace: Workspace, path: string, caseInsensitive = false): boolean {
  return workspace.favourites.some((fav) => isSamePath(fav.path, path, caseInsensitive));
}

export function addFavourite(
  workspace: Workspace,
  favourite: Favourite,
  caseInsensitive = false,
): Workspace {
  if (isFavourite(workspace, favourite.path, caseInsensitive)) return workspace;
  return { ...workspace, favourites: [...workspace.favourites, favourite] };
}

export function removeFavourite(
  workspace: Workspace,
  path: string,
  caseInsensitive = false,
): Workspace {
  const favourites = workspace.favourites.filter(
    (fav) => !isSamePath(fav.path, path, caseInsensitive),
  );
  return { ...workspace, favourites };
}

export function toggleFavourite(
  workspace: Workspace,
  favourite: Favourite,
  caseInsensitive = false,
): Workspace {
  return isFavourite(workspace, favourite.path, caseInsensitive)
    ? removeFavourite(workspace, favourite.path, caseInsensitive)
    : addFavourite(workspace, favourite, caseInsensitive);
}

/** Moves the favourite at index `from` to index `to`; both indices are clamped to the list. */
export function moveFavourite(workspace: Workspace, from: number, to: number): Workspace {
  const last = workspace.favourites.length - 1;
  const source = clamp(from, 0, last);
  const target = clamp(to, 0, last);
  if (source === target) return workspace;
  const favourites = [...workspace.favourites];
  const [moved] = favourites.splice(source, 1);
  favourites.splice(target, 0, moved);
  return { ...workspace, favourites };
}

/** Re-points the open folder and favourites at or below `oldPath` to `newPath` (rename or move). */
export function renamePath(
  workspace: Workspace,
  oldPath: string,
  newPath: string,
  caseInsensitive = false,
): Workspace {
  const retarget = (path: string) => retargetPath(path, oldPath, newPath, caseInsensitive);
  const renamed = workspace.favourites.map((fav) => ({ ...fav, path: retarget(fav.path) }));
  return {
    folder: workspace.folder === null ? null : retarget(workspace.folder),
    favourites: renamed.filter(
      (fav, i) =>
        renamed.findIndex((other) => isSamePath(other.path, fav.path, caseInsensitive)) === i,
    ),
  };
}

/** Drops the favourites at or below a deleted path. */
export function forgetPath(workspace: Workspace, path: string, caseInsensitive = false): Workspace {
  const favourites = workspace.favourites.filter(
    (fav) => !isSameOrInside(path, fav.path, caseInsensitive),
  );
  return { ...workspace, favourites };
}

export function withMissing(
  favourites: readonly Favourite[],
  exists: (path: string) => boolean,
): FavouriteWithStatus[] {
  return favourites.map((fav) => ({ ...fav, missing: !exists(fav.path) }));
}

function retargetPath(
  path: string,
  oldPath: string,
  newPath: string,
  caseInsensitive: boolean,
): string {
  if (!isSameOrInside(oldPath, path, caseInsensitive)) return path;
  const rest = normalisePath(path).slice(normalisePath(oldPath).length);
  return joinPath(newPath, ...rest.split('/'));
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);
