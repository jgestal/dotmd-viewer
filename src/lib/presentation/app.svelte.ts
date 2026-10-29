// The app's live state and the actions the UI triggers. It owns the plain state objects the use
// cases work on (document, preferences) and turns their results into reactive runes; components
// read `app.*` and call its methods instead of talking to the use cases directly.
import type { DocumentState } from '$lib/application/documents';
import type { MoveResult, PathChange } from '$lib/application/workspace';
import { createContainer, type Container } from '$lib/container';
import type { DropEvent } from '$lib/ports';
import { isDirty } from '$lib/domain/document';
import type { FavouriteWithStatus } from '$lib/domain/workspace';
import { toAppError } from '$lib/domain/errors';
import {
  defaultPreferences,
  resetZoom,
  zoomIn,
  zoomOut,
  type Preferences,
} from '$lib/domain/preferences';
import { createAppCommands } from './appCommands';
import type { CommandId } from './commands/ids';
import { createRegistry, type CommandRegistry } from './commands/registry';
import { i18n } from './i18n/i18n.svelte';
import { currentPlatform } from './platform';
import { fallbackContextMenu } from './contextMenu/fallbackMenu.svelte';
import { notifier } from './toasts.svelte';

export type EditMode = Preferences['editMode'];
export type Layout = Preferences['layout'];
export type FavouriteKind = Preferences['favourites'][number]['kind'];
export type SidebarTab = Preferences['sidebarTab'];
export type EntryKind = FavouriteKind;

/** Preferences are written at most this often while the user drags a slider or resizes. */
const SAVE_DELAY_MS = 400;
/** A shortcut delivered by both the native menu and the page arrives within this window. */
const DUPLICATE_WINDOW_MS = 200;

class App {
  preferences = $state<Preferences>(defaultPreferences);
  documentState = $state<DocumentState>({ doc: null });
  /** Documents open read-only; editing is switched on per session with "Edit". */
  editing = $state(false);
  /** Caret position (1-based) in the code editor; null when no editor has one. */
  cursor = $state<{ line: number; column: number } | null>(null);
  ready = $state(false);
  /** Paths being dragged over the window, or null when no drag is under way. */
  draggedPaths = $state<readonly string[] | null>(null);
  /** Favourite paths found missing on disk by the last `refreshFavourites`. */
  #missingFavourites = $state<readonly string[]>([]);
  #favouritesRun = 0;
  /** Files being carried out of the window by a system drag. */
  #draggedOut: readonly string[] = [];

  readonly platform = currentPlatform();
  readonly commands: CommandRegistry;
  #container: Container | null = null;
  #saveTimer: ReturnType<typeof setTimeout> | undefined;
  #lastCommand: { id: CommandId; at: number } | null = null;

  constructor() {
    this.commands = createRegistry(createAppCommands(this));
  }

  get document() {
    return this.documentState.doc;
  }

  /** The favourites in order, each flagged when its file or folder is gone. */
  get favourites(): FavouriteWithStatus[] {
    return this.preferences.favourites.map((fav) => ({
      ...fav,
      missing: this.#missingFavourites.includes(fav.path),
    }));
  }

  get dirty(): boolean {
    return this.document !== null && isDirty(this.document);
  }

  get container(): Container {
    if (!this.#container) throw new Error('app.start() has not run yet');
    return this.#container;
  }

  async start(): Promise<void> {
    this.#container = createContainer({
      notifier,
      t: (key, vars) => i18n.t(key, vars),
      fallbackContextMenu,
    });
    const { preferences, watcher, openRequests, dropTarget } = this.#container;
    this.preferences = await preferences.load();
    i18n.setPreference(this.preferences.language);

    watcher.onChange((path) => void this.#externalChange(path));
    openRequests.onOpen((paths) => void this.openPaths(paths));
    dropTarget.onDrag((event) => this.#onDrag(event));
    const { window } = this.#container;
    window.onCloseRequested(() => this.confirmQuit());
    window.onQuitRequested(() => void this.quit());
    const pending = await openRequests.takePending();
    if (pending.length > 0) await this.openPaths(pending);
    else if (this.preferences.lastFile) await this.open(this.preferences.lastFile, { quiet: true });
    this.ready = true;
    // The window starts hidden; showing it here means the first painted frame is the real one.
    await this.container.window.reveal();
  }

  // Documents

  async open(path: string, { quiet = false } = {}): Promise<void> {
    const result = await this.container.documents.open(this.documentState, path);
    if (!result) {
      if (quiet) this.setPreference('lastFile', null);
      return;
    }
    this.documentState = result.state;
    this.editing = false;
    this.preferences = this.container.workspace.rememberOpened(this.preferences, result.openedPath);
    this.#scheduleSave();
  }

  /** Hands a web or mail link to the system; failures become a toast. */
  async openExternal(url: string): Promise<void> {
    try {
      await this.container.opener.openExternal(url);
    } catch (thrown) {
      notifier.error(toAppError(thrown).message);
    }
  }

  /** The OS asked us to open these (or they were dropped): the last folder and the last file win. */
  async openPaths(paths: readonly string[]): Promise<void> {
    const { folder, file } = await this.container.drop.plan(paths);
    if (folder !== null) await this.openFolder(folder);
    if (file !== null) await this.open(file);
  }

  #onDrag({ type, paths }: DropEvent): void {
    if (this.#draggedOut.length > 0 && paths.every((path) => this.#draggedOut.includes(path))) {
      return;
    }
    this.draggedPaths = type === 'leave' || type === 'drop' ? null : paths;
    if (type === 'drop') void this.openPaths(paths);
  }

  async openWithDialog(): Promise<void> {
    const result = await this.container.documents.openWithDialog(this.documentState);
    if (!result) return;
    this.documentState = result.state;
    this.editing = false;
    this.preferences = this.container.workspace.rememberOpened(this.preferences, result.openedPath);
    this.#scheduleSave();
  }

  async newDocument(): Promise<void> {
    const state = await this.container.documents.newDocument(this.documentState);
    if (!state) return;
    this.documentState = state;
    this.editing = true;
    if (this.preferences.editMode === 'preview') this.setPreference('editMode', 'code');
  }

  async save(): Promise<void> {
    const state = await this.container.documents.save(this.documentState);
    if (state) this.#afterSave(state);
  }

  async saveAs(): Promise<void> {
    const state = await this.container.documents.saveAs(this.documentState);
    if (state) this.#afterSave(state);
  }

  async close(): Promise<void> {
    const state = await this.container.documents.close(this.documentState);
    if (!state) return;
    this.documentState = state;
    this.editing = false;
    this.setPreference('lastFile', null);
  }

  async edit(content: string): Promise<void> {
    this.documentState = await this.container.documents.edit(this.documentState, content);
  }

  /** Quits the app after asking about unsaved changes; cancelling keeps it running. */
  async quit(): Promise<void> {
    if (await this.confirmQuit()) await this.container.window.quit();
  }

  /** Asked by the window before it closes; false keeps it open. */
  confirmQuit(): Promise<boolean> {
    return this.container.documents.confirmQuit(this.documentState);
  }

  #afterSave(state: DocumentState): void {
    this.documentState = state;
    const path = state.doc?.path;
    if (path) this.preferences = this.container.workspace.rememberOpened(this.preferences, path);
    this.#scheduleSave();
  }

  async #externalChange(path: string): Promise<void> {
    const state = await this.container.documents.externalChange(this.documentState, path);
    if (state) this.documentState = state;
  }

  // Folders

  async openFolder(path: string): Promise<void> {
    this.#applyPreferences(await this.container.workspace.openFolder(this.preferences, path));
    this.setPreference('sidebarVisible', true);
    this.setPreference('sidebarTab', 'explorer');
  }

  async chooseFolder(): Promise<void> {
    const preferences = await this.container.workspace.chooseFolder(this.preferences);
    if (preferences === this.preferences) return;
    this.#applyPreferences(preferences);
    this.setPreference('sidebarVisible', true);
    this.setPreference('sidebarTab', 'explorer');
  }

  /** Entries of a folder for the explorer tree (empty when it cannot be read). */
  listFolder(path: string) {
    return this.container.workspace.browse(path);
  }

  /** Renames a file or folder; answers where it went, or `null` when nothing happened. */
  async renameEntry(path: string, newName: string, kind: EntryKind): Promise<PathChange | null> {
    return this.#followMove(
      await this.container.workspace.rename(this.preferences, path, newName, kind),
    );
  }

  /** Moves a file or folder into `folder`, keeping its name; answers where it went, or `null`. */
  async moveEntry(path: string, folder: string): Promise<PathChange | null> {
    return this.#followMove(await this.container.workspace.move(this.preferences, path, folder));
  }

  /**
   * Hands files to the system as a drag out of the window (Finder, mail, other apps). While the
   * system drag runs, dragging them back over the window is not an open request.
   */
  async dragOut(paths: readonly string[]): Promise<void> {
    this.#draggedOut = paths;
    try {
      await this.container.dragOut.start(paths);
    } catch (thrown) {
      notifier.error(toAppError(thrown).message);
    } finally {
      this.#draggedOut = [];
    }
  }

  /** Asks to trash a file or folder; answers whether it was trashed. */
  async trashEntry(path: string): Promise<boolean> {
    const { prefs, trashed } = await this.container.workspace.trash(this.preferences, path);
    this.#applyPreferences(prefs);
    return trashed;
  }

  revealEntry(path: string): Promise<void> {
    return this.container.workspace.reveal(path);
  }

  /** Applies a rename's new preferences and re-points the open document at the new path. */
  async #followMove({ prefs, change }: MoveResult): Promise<PathChange | null> {
    this.#applyPreferences(prefs);
    if (change === null) return null;
    const state = await this.container.documents.followMove(this.documentState, change);
    if (state) this.documentState = state;
    return change;
  }

  // Favourites

  isFavourite(path: string): boolean {
    return this.container.workspace.isFavourite(this.preferences, path);
  }

  toggleFavourite(path: string, kind: FavouriteKind): void {
    this.#applyPreferences(this.container.workspace.toggleFavourite(this.preferences, path, kind));
  }

  removeFavourite(path: string): void {
    this.#applyPreferences(this.container.workspace.removeFavourite(this.preferences, path));
  }

  moveFavourite(from: number, to: number): void {
    this.#applyPreferences(this.container.workspace.moveFavourite(this.preferences, from, to));
  }

  /** Checks the disk for missing favourites; an answer that arrives after a newer call is dropped. */
  async refreshFavourites(): Promise<void> {
    const run = ++this.#favouritesRun;
    const checked = await this.container.workspace.favouritesWithStatus(this.preferences);
    if (run !== this.#favouritesRun) return;
    this.#missingFavourites = checked.filter((fav) => fav.missing).map((fav) => fav.path);
  }

  // View

  toggleEditing(): void {
    if (!this.document) return;
    this.editing = !this.editing;
  }

  setEditMode(mode: EditMode): void {
    this.editing = this.document !== null;
    this.setPreference('editMode', mode);
  }

  setLayout(layout: Layout): void {
    this.setPreference('layout', layout);
  }

  toggleSidebar(): void {
    this.setPreference('sidebarVisible', !this.preferences.sidebarVisible);
  }

  showSidebarTab(tab: SidebarTab): void {
    this.setPreference('sidebarTab', tab);
    this.setPreference('sidebarVisible', true);
  }

  zoomIn(): void {
    this.setPreference('zoom', zoomIn(this.preferences.zoom));
  }

  zoomOut(): void {
    this.setPreference('zoom', zoomOut(this.preferences.zoom));
  }

  resetZoom(): void {
    this.setPreference('zoom', resetZoom());
  }

  clearRecents(): void {
    this.#applyPreferences(this.container.workspace.clearRecents(this.preferences));
  }

  toggleFullscreen(): Promise<void> {
    return this.container.window.toggleFullscreen();
  }

  /**
   * Runs a command from a shortcut or the native menu. On some desktops a shortcut reaches both
   * the menu and the page; the second arrival within a moment is the same keystroke, so it is
   * dropped.
   */
  runCommand(id: CommandId): void {
    const now = Date.now();
    if (this.#lastCommand?.id === id && now - this.#lastCommand.at < DUPLICATE_WINDOW_MS) return;
    this.#lastCommand = { id, at: now };
    void this.commands.execute(id);
  }

  // Preferences

  setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
    if (this.preferences[key] === value) return;
    this.preferences = { ...this.preferences, [key]: value };
    if (key === 'language') i18n.setPreference(this.preferences.language);
    this.#scheduleSave();
  }

  #applyPreferences(preferences: Preferences): void {
    this.preferences = preferences;
    this.#scheduleSave();
  }

  #scheduleSave(): void {
    if (!this.#container) return;
    clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => {
      void this.container.preferences.save(this.preferences);
    }, SAVE_DELAY_MS);
  }
}

export type { App };

export const app = new App();
