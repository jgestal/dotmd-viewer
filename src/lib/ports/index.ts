// Ports: what the application layer needs from the outside world, as interfaces only.
// infrastructure/tauri implements them for the app and infrastructure/memory for tests; the
// domain and application layers never import Tauri, Svelte or the DOM.
// Every method that can fail rejects with an AppError (domain/errors.ts).

import type { Encoding } from '../domain/document';
import type { PageSetup } from '../domain/printing';

export interface TextFile {
  readonly content: string;
  readonly encoding: Encoding;
  readonly hasBom: boolean;
}

export type EntryKind = 'file' | 'folder';

export interface DirEntry {
  readonly name: string;
  readonly path: string;
  readonly kind: EntryKind;
  /** Folders only: whether expanding it would show anything. */
  readonly hasChildren?: boolean;
}

/** Files on disk. Listing only returns Markdown/text files and folders, hidden entries excluded. */
export interface FileSystem {
  readText(path: string): Promise<TextFile>;
  writeText(path: string, file: TextFile): Promise<void>;
  listDir(path: string): Promise<readonly DirEntry[]>;
  exists(path: string): Promise<boolean>;
  /** What the path is on disk; `missing` when nothing is there. */
  kind(path: string): Promise<EntryKind | 'missing'>;
  /** Renames or moves; rejects with `alreadyExists` rather than overwrite. */
  rename(from: string, to: string): Promise<void>;
  /** Sends to the system trash / recycle bin. */
  trash(path: string): Promise<void>;
  /** Creates the folder and any missing parents; does nothing when it already exists. */
  ensureDir(path: string): Promise<void>;
  /** Copies a file into a directory under a free name and returns the new file's path. */
  copyInto(source: string, directory: string): Promise<string>;
  /** Shows the item in Finder / Explorer / the file manager. */
  reveal(path: string): Promise<void>;
}

/** Notifies when a watched file changes on disk; one file at a time. */
export interface FileWatcher {
  watch(path: string | null): Promise<void>;
  onChange(listener: (path: string) => void): () => void;
}

export interface RenderedMarkdown {
  readonly html: string;
  readonly frontMatter: string | null;
}

/** Markdown → HTML (comrak in Rust). The HTML is not sanitised yet. */
export interface MarkdownRenderer {
  render(markdown: string): Promise<RenderedMarkdown>;
}

export interface FileFilter {
  readonly name: string;
  readonly extensions: readonly string[];
}

export type UnsavedChoice = 'save' | 'discard' | 'cancel';

/** Native dialogs; texts arrive already translated. */
export interface Dialogs {
  openFile(filters: readonly FileFilter[]): Promise<string | null>;
  openFolder(): Promise<string | null>;
  saveFile(defaultPath: string, filters: readonly FileFilter[]): Promise<string | null>;
  askUnsaved(fileName: string): Promise<UnsavedChoice>;
  confirm(title: string, message: string, ok: string, cancel: string): Promise<boolean>;
  alert(title: string, message: string): Promise<void>;
}

/** The app window: title, macOS edited dot and proxy icon, full screen, and when it shows. */
export interface AppWindow {
  showDocument(title: string, path: string | null, edited: boolean): Promise<void>;
  toggleFullscreen(): Promise<void>;
  /** Shows the window, which starts hidden so it never flashes or jumps while loading. */
  reveal(): Promise<void>;
  /**
   * Asks before the window closes (close button, Alt+F4): `true` lets it close, which quits the
   * app; `false` keeps it open. Returns the function that removes the handler.
   */
  onCloseRequested(handler: () => Promise<boolean>): () => void;
  /** Called when the system asks to quit (Dock, Cmd+Q): the handler decides, then calls `quit`. */
  onQuitRequested(handler: () => void): () => void;
  /** Exits the app now, without asking: the caller already confirmed any unsaved changes. */
  quit(): Promise<void>;
}

/** Menu items the operating system implements itself (clipboard, window management…). */
export type PredefinedMenuItem =
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'selectAll'
  | 'minimize'
  | 'maximize'
  | 'fullscreen'
  | 'bringAllToFront'
  | 'services'
  | 'hide'
  | 'hideOthers'
  | 'showAll'
  | 'about';

/** The menu bar as data; labels are translated, accelerators in Tauri syntax (CmdOrCtrl+S). */
export type MenuNode =
  | { readonly kind: 'submenu'; readonly label: string; readonly items: readonly MenuNode[] }
  | {
      readonly kind: 'command';
      readonly id: string;
      readonly label: string;
      readonly accelerator?: string;
      readonly enabled: boolean;
      readonly checked?: boolean;
    }
  | { readonly kind: 'recent'; readonly path: string; readonly label: string }
  | { readonly kind: 'predefined'; readonly item: PredefinedMenuItem; readonly label: string }
  | { readonly kind: 'separator' };

export interface AboutInfo {
  readonly name: string;
  readonly credits: string;
  readonly website: string;
  readonly copyright: string;
}

export interface MenuHandlers {
  onCommand(id: string): void;
  onRecent(path: string): void;
}

/** The native menu bar: the app menu on macOS, the window's menu bar on Windows and Linux. */
export interface NativeMenu {
  install(menu: readonly MenuNode[], about: AboutInfo, handlers: MenuHandlers): Promise<void>;
}

/** Durable storage for the preferences file; parsing and validation live in the domain. */
export interface PreferencesStore {
  load(): Promise<unknown>;
  save(serialised: string): Promise<void>;
}

/** Files the OS asked us to open: launch arguments, Finder "Open with", a second instance. */
export interface OpenRequests {
  takePending(): Promise<readonly string[]>;
  onOpen(listener: (paths: readonly string[]) => void): () => void;
}

/** What the user is doing with files dragged over the window. `paths` is empty on `leave`. */
export interface DropEvent {
  readonly type: 'enter' | 'over' | 'leave' | 'drop';
  readonly paths: readonly string[];
  /** Where the pointer is, in CSS pixels from the window's top-left; absent on `leave`. */
  readonly position?: { readonly x: number; readonly y: number };
}

/** Drag and drop of files and folders from the OS onto the window. */
export interface DropTarget {
  onDrag(listener: (event: DropEvent) => void): () => void;
}

/** Hands files to the operating system as a drag that continues outside the window. */
export interface DragOut {
  /** `iconPath` is the image under the cursor; the adapter picks a default when it is omitted. */
  start(paths: readonly string[], iconPath?: string): Promise<void>;
}

/** Opens addresses in the user's default browser or mail client. */
export interface ExternalOpener {
  openExternal(url: string): Promise<void>;
}

/** Facts about the running app. */
export interface AppInfo {
  version(): Promise<string>;
}

export interface MenuItem {
  readonly id: string;
  /** Already translated. */
  readonly label: string;
  /** Defaults to true. */
  readonly enabled?: boolean;
  /** Draws a separator above the item. */
  readonly separatorBefore?: boolean;
}

/** A pop-up menu at a window position (CSS pixels); resolves the chosen id, or `null` when dismissed. */
export interface ContextMenu {
  show(
    items: readonly MenuItem[],
    at?: { readonly x: number; readonly y: number },
  ): Promise<string | null>;
}

/** The system print dialog for what the webview currently shows (the printable document). */
export interface Printer {
  print(): Promise<void>;
}

/** `saved`: the file was written; `printDialog`: the platform could only open the print dialog. */
export type ExportOutcome = 'saved' | 'printDialog';

/** Writes what the webview currently shows (the printable document) to a PDF file. */
export interface PdfExporter {
  export(path: string, page: PageSetup): Promise<ExportOutcome>;
}

/** Addresses the webview can load a local file from (images in the rendered document). */
export interface AssetUrls {
  /** The URL that shows the file at `path`, or `null` when this environment cannot load it. */
  toUrl(path: string): string | null;
}

/** Short, non-blocking messages to the user. */
export interface Notifier {
  info(message: string): void;
  error(message: string): void;
}

/** Localised strings; presentation provides the implementation. */
export type Translate = (key: string, vars?: Readonly<Record<string, string | number>>) => string;
