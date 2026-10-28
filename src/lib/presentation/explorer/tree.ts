// The explorer tree as plain data: which folders are expanded, which listings are loaded, and the
// flat list of visible rows that rendering and keyboard navigation work on. Nothing is mutated.
import { dirName, isSameOrInside, isSamePath } from '$lib/domain/paths';
import type { DirEntry } from '$lib/ports';

export interface TreeState {
  readonly expanded: ReadonlySet<string>;
  /** Loaded listings by folder path. A missing key means "not loaded yet". */
  readonly children: ReadonlyMap<string, readonly DirEntry[]>;
}

export interface TreeRow {
  readonly entry: DirEntry;
  /** 1 for the entries directly under the root, as aria-level expects. */
  readonly level: number;
  readonly expandable: boolean;
  readonly expanded: boolean;
  /** Path of the containing folder; `null` for the entries directly under the root. */
  readonly parent: string | null;
}

export const emptyTree: TreeState = { expanded: new Set(), children: new Map() };

export const isExpandable = (entry: DirEntry): boolean =>
  entry.kind === 'folder' && entry.hasChildren === true;

export function expand(state: TreeState, ...paths: readonly string[]): TreeState {
  return { ...state, expanded: new Set([...state.expanded, ...paths]) };
}

export function collapse(state: TreeState, path: string): TreeState {
  const expanded = new Set(state.expanded);
  expanded.delete(path);
  return { ...state, expanded };
}

export function toggle(state: TreeState, path: string): TreeState {
  return state.expanded.has(path) ? collapse(state, path) : expand(state, path);
}

/** Stores the listing of a folder, replacing any earlier one (this is also how a refresh lands). */
export function withChildren(
  state: TreeState,
  path: string,
  entries: readonly DirEntry[],
): TreeState {
  return { ...state, children: new Map(state.children).set(path, entries) };
}

/** Forgets every loaded listing, keeping what is expanded. */
export function withoutListings(state: TreeState): TreeState {
  return { ...state, children: new Map() };
}

/** The rows to show under `root`, depth first, descending only into expanded and loaded folders. */
export function visibleRows(state: TreeState, root: string): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (folder: string, level: number, parent: string | null): void => {
    for (const entry of state.children.get(folder) ?? []) {
      const expandable = isExpandable(entry);
      const expanded = expandable && state.expanded.has(entry.path);
      rows.push({ entry, level, expandable, expanded, parent });
      if (expanded) walk(entry.path, level + 1, entry.path);
    }
  };
  walk(root, 1, null);
  return rows;
}

/** Expanded folders that are visible but whose listing has not been loaded yet (root included). */
export function foldersToLoad(state: TreeState, root: string): string[] {
  const open = visibleRows(state, root)
    .filter((row) => row.expanded)
    .map((row) => row.entry.path);
  return [root, ...open].filter((path) => !state.children.has(path));
}

/** Folders between `root` (exclusive) and `file` (exclusive), outermost first; empty if outside. */
export function ancestorsWithin(root: string, file: string, caseInsensitive = false): string[] {
  if (!isSameOrInside(root, file, caseInsensitive)) return [];
  const ancestors: string[] = [];
  for (let dir = dirName(file); !isSamePath(dir, root, caseInsensitive); dir = dirName(dir)) {
    ancestors.unshift(dir);
  }
  return ancestors;
}

const indexOfPath = (rows: readonly TreeRow[], path: string): number =>
  rows.findIndex((row) => row.entry.path === path);

export function nextPath(rows: readonly TreeRow[], path: string): string | null {
  return rows[indexOfPath(rows, path) + 1]?.entry.path ?? null;
}

export function previousPath(rows: readonly TreeRow[], path: string): string | null {
  const index = indexOfPath(rows, path);
  return index > 0 ? rows[index - 1].entry.path : null;
}

export function parentPath(rows: readonly TreeRow[], path: string): string | null {
  return rows[indexOfPath(rows, path)]?.parent ?? null;
}

/** First child of an expanded folder; the row after it is its child exactly when its parent matches. */
export function firstChildPath(rows: readonly TreeRow[], path: string): string | null {
  const index = indexOfPath(rows, path);
  const next = rows[index + 1];
  return rows[index]?.expanded && next?.parent === path ? next.entry.path : null;
}

export const firstPath = (rows: readonly TreeRow[]): string | null => rows[0]?.entry.path ?? null;

export const lastPath = (rows: readonly TreeRow[]): string | null =>
  rows.at(-1)?.entry.path ?? null;
