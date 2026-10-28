// Ports: what the application layer needs from the outside world, as interfaces only.
// infrastructure/tauri implements them for the app and infrastructure/memory for tests; the
// domain and application layers never import Tauri, Svelte or the DOM.
// Every method that can fail rejects with an AppError (domain/errors.ts).

import type { Encoding } from '../domain/document';

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
  /** Renames or moves; rejects with `alreadyExists` rather than overwrite. */
  rename(from: string, to: string): Promise<void>;
  /** Sends to the system trash / recycle bin. */
  trash(path: string): Promise<void>;
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

/** The app window: title, macOS edited dot and proxy icon. */
export interface AppWindow {
  showDocument(title: string, path: string | null, edited: boolean): Promise<void>;
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

/** Opens addresses in the user's default browser or mail client. */
export interface ExternalOpener {
  openExternal(url: string): Promise<void>;
}

/** Short, non-blocking messages to the user. */
export interface Notifier {
  info(message: string): void;
  error(message: string): void;
}

/** Localised strings; presentation provides the implementation. */
export type Translate = (key: string, vars?: Readonly<Record<string, string | number>>) => string;
