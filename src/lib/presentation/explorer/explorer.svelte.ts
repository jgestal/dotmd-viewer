// The explorer's live tree. It outlives the panel (switching sidebar tabs unmounts the panel), so
// the folders the user expanded are remembered for the session.
import { app } from '../app.svelte';
import {
  ancestorsWithin,
  collapse,
  emptyTree,
  expand,
  foldersToLoad,
  toggle,
  withChildren,
  withoutListings,
  type TreeState,
} from './tree';

class Explorer {
  tree = $state<TreeState>(emptyTree);
  #root: string | null = null;
  #loading = new Set<string>();

  /** Points the tree at a folder; a different one starts from fresh listings. */
  setRoot(root: string | null): void {
    if (root === this.#root) return;
    this.#root = root;
    this.#loading.clear();
    this.tree = withoutListings(this.tree);
  }

  /** Loads the root and every expanded folder that has not been listed yet. */
  loadMissing(): void {
    if (this.#root === null) return;
    for (const path of foldersToLoad(this.tree, this.#root)) {
      if (!this.#loading.has(path)) void this.refresh(path);
    }
  }

  /** Lists one folder again, e.g. after a file in it was created, renamed or trashed. */
  async refresh(path: string): Promise<void> {
    const root = this.#root;
    this.#loading.add(path);
    const entries = await app.listFolder(path);
    this.#loading.delete(path);
    if (root === this.#root) this.tree = withChildren(this.tree, path, entries);
  }

  toggle(path: string): void {
    this.tree = toggle(this.tree, path);
  }

  expand(path: string): void {
    this.tree = expand(this.tree, path);
  }

  collapse(path: string): void {
    this.tree = collapse(this.tree, path);
  }

  /** Expands the folders above `file` so it becomes visible. */
  reveal(file: string): void {
    if (this.#root !== null) this.tree = expand(this.tree, ...ancestorsWithin(this.#root, file));
  }
}

export const explorer = new Explorer();
