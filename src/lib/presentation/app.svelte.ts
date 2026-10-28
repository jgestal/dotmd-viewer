// The app's live state and the actions the UI triggers. It owns the plain state objects the use
// cases work on (document, preferences) and turns their results into reactive runes; components
// read `app.*` and call its methods instead of talking to the use cases directly.
import type { DocumentState } from '$lib/application/documents';
import { createContainer, type Container } from '$lib/container';
import { isDirty } from '$lib/domain/document';
import type { FavouriteWithStatus } from '$lib/domain/workspace';
import {
  defaultPreferences,
  resetZoom,
  zoomIn,
  zoomOut,
  type Preferences,
} from '$lib/domain/preferences';
import { createAppCommands } from './appCommands';
import { createRegistry, type CommandRegistry } from './commands/registry';
import { i18n } from './i18n/i18n.svelte';
import { currentPlatform } from './platform';
import { notifier } from './toasts.svelte';

export type EditMode = Preferences['editMode'];
export type Layout = Preferences['layout'];
export type FavouriteKind = Preferences['favourites'][number]['kind'];
export type SidebarTab = Preferences['sidebarTab'];

/** Preferences are written at most this often while the user drags a slider or resizes. */
const SAVE_DELAY_MS = 400;

class App {
  preferences = $state<Preferences>(defaultPreferences);
  documentState = $state<DocumentState>({ doc: null });
  /** Documents open read-only; editing is switched on per session with "Edit". */
  editing = $state(false);
  /** Caret position (1-based) in the code editor; null when no editor has one. */
  cursor = $state<{ line: number; column: number } | null>(null);
  ready = $state(false);
  /** Favourite paths found missing on disk by the last `refreshFavourites`. */
  #missingFavourites = $state<readonly string[]>([]);
  #favouritesRun = 0;

  readonly platform = currentPlatform();
  readonly commands: CommandRegistry;
  #container: Container | null = null;
  #saveTimer: ReturnType<typeof setTimeout> | undefined;

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
    this.#container = createContainer({ notifier, t: (key, vars) => i18n.t(key, vars) });
    const { preferences, watcher, openRequests } = this.#container;
    this.preferences = await preferences.load();
    i18n.setPreference(this.preferences.language);

    watcher.onChange((path) => void this.#externalChange(path));
    openRequests.onOpen((paths) => void this.openPaths(paths));
    const pending = await openRequests.takePending();
    if (pending.length > 0) await this.openPaths(pending);
    else if (this.preferences.lastFile) await this.open(this.preferences.lastFile, { quiet: true });
    this.ready = true;
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

  /** The OS asked us to open these: the last file wins, a folder becomes the explorer root. */
  async openPaths(paths: readonly string[]): Promise<void> {
    for (const path of paths) {
      if (/\.(md|markdown|mdown|mkd|txt)$/i.test(path)) await this.open(path);
      else await this.openFolder(path);
    }
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
