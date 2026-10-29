// In-memory FileSystem for tests. It mirrors the Rust side: the same errors, the same listing rules.
import { appError, type AppError } from '../../domain/errors';
import { baseName, dirName, joinPath, normalisePath } from '../../domain/paths';
import type { DirEntry, EntryKind, FileSystem, TextFile } from '../../ports';

export type FileSystemMethod = keyof FileSystem;

export interface FileSystemCall {
  readonly method: FileSystemMethod;
  readonly args: readonly string[];
}

export interface SeedOptions {
  readonly encoding?: TextFile['encoding'];
  readonly hasBom?: boolean;
}

type ExternalWriteListener = (path: string) => void;

const LISTED_EXTENSIONS = /\.(md|markdown|txt)$/i;
const naturalOrder = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const isHidden = (name: string): boolean => name.startsWith('.');
const isListedFile = (name: string): boolean => !isHidden(name) && LISTED_EXTENSIONS.test(name);

/** Splits `img.png` into `img` and `.png`; a leading dot is part of the stem. */
const splitExtension = (name: string): [string, string] => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
};

const isDirectChild = (folder: string, path: string): boolean =>
  path !== folder && dirName(path) === folder;

const isSameOrBelow = (root: string, path: string): boolean =>
  path === root || path.startsWith(root.endsWith('/') ? root : `${root}/`);

/** Folders first, then natural case-insensitive order (`a2` before `a10`). */
const compareEntries = (a: DirEntry, b: DirEntry): number =>
  Number(b.kind === 'folder') - Number(a.kind === 'folder') || naturalOrder.compare(a.name, b.name);

export class MemoryFileSystem implements FileSystem {
  /** Paths sent to the trash, in order. */
  readonly trashed: string[] = [];
  /** Paths shown in the file manager, in order. */
  readonly revealed: string[] = [];
  /** Every port call made, in order (seeding and `simulateExternalWrite` are not recorded). */
  readonly calls: FileSystemCall[] = [];

  private readonly files = new Map<string, TextFile>();
  private readonly folders = new Set<string>();
  private readonly failures = new Map<FileSystemMethod, AppError[]>();
  private readonly externalWriteListeners = new Set<ExternalWriteListener>();

  /** Creates (or overwrites) a file, and any missing folders above it. */
  seedFile(path: string, content: string, options: SeedOptions = {}): void {
    const key = normalisePath(path);
    this.seedFolder(dirName(key));
    this.files.set(key, {
      content,
      encoding: options.encoding ?? 'utf-8',
      hasBom: options.hasBom ?? false,
    });
  }

  /** Creates a folder and every folder above it. */
  seedFolder(path: string): void {
    let current = normalisePath(path);
    while (!this.folders.has(current)) {
      this.folders.add(current);
      const parent = dirName(current);
      if (parent === current) return;
      current = parent;
    }
  }

  /** Makes the next call to `method` reject with `error`; several scripted failures are used in order. */
  failNext(method: FileSystemMethod, error: AppError): void {
    this.failures.set(method, [...(this.failures.get(method) ?? []), error]);
  }

  /** Subscribes to writes made "outside the app" (see `simulateExternalWrite`). */
  onExternalWrite(listener: ExternalWriteListener): () => void {
    this.externalWriteListeners.add(listener);
    return () => this.externalWriteListeners.delete(listener);
  }

  /** Changes a file as another program would, then tells the subscribers (the watcher). */
  simulateExternalWrite(path: string, content: string): void {
    const key = normalisePath(path);
    this.seedFile(key, content, this.files.get(key));
    this.externalWriteListeners.forEach((listener) => listener(key));
  }

  async readText(path: string): Promise<TextFile> {
    this.begin('readText', path);
    return this.fileAt(normalisePath(path), path);
  }

  async writeText(path: string, file: TextFile): Promise<void> {
    this.begin('writeText', path);
    const key = normalisePath(path);
    if (this.folders.has(key)) throw appError('invalidInput', 'Is a folder', path);
    this.requireFolder(dirName(key), path);
    this.files.set(key, file);
  }

  async listDir(path: string): Promise<readonly DirEntry[]> {
    this.begin('listDir', path);
    const key = normalisePath(path);
    if (this.files.has(key)) throw appError('invalidInput', 'Not a folder', path);
    this.requireFolder(key, path);
    return this.visibleChildren(key).sort(compareEntries);
  }

  async exists(path: string): Promise<boolean> {
    this.begin('exists', path);
    return this.isTaken(normalisePath(path));
  }

  async kind(path: string): Promise<EntryKind | 'missing'> {
    this.begin('kind', path);
    const key = normalisePath(path);
    if (this.folders.has(key)) return 'folder';
    return this.files.has(key) ? 'file' : 'missing';
  }

  async rename(from: string, to: string): Promise<void> {
    this.begin('rename', from, to);
    const source = normalisePath(from);
    const target = normalisePath(to);
    this.requireExisting(source, from);
    if (this.isTaken(target)) throw appError('alreadyExists', 'Already exists', to);
    this.requireFolder(dirName(target), to);
    this.moveTree(source, target);
  }

  async trash(path: string): Promise<void> {
    this.begin('trash', path);
    const key = normalisePath(path);
    this.requireExisting(key, path);
    this.removeTree(key);
    this.trashed.push(key);
  }

  async ensureDir(path: string): Promise<void> {
    this.begin('ensureDir', path);
    const key = normalisePath(path);
    if (this.files.has(key)) throw appError('invalidInput', 'Is a file', path);
    this.seedFolder(key);
  }

  async copyInto(source: string, directory: string): Promise<string> {
    this.begin('copyInto', source, directory);
    const file = this.fileAt(normalisePath(source), source);
    const folder = normalisePath(directory);
    this.requireFolder(folder, directory);
    const target = this.freePath(folder, baseName(source));
    this.files.set(target, file);
    return target;
  }

  async reveal(path: string): Promise<void> {
    this.begin('reveal', path);
    const key = normalisePath(path);
    this.requireExisting(key, path);
    this.revealed.push(key);
  }

  /** Records the call and throws the scripted failure for it, if any. */
  private begin(method: FileSystemMethod, ...args: string[]): void {
    this.calls.push({ method, args });
    const [error, ...rest] = this.failures.get(method) ?? [];
    if (error) {
      this.failures.set(method, rest);
      throw error;
    }
  }

  private fileAt(key: string, reported: string): TextFile {
    const file = this.files.get(key);
    if (!file) throw appError('notFound', 'No such file', reported);
    return file;
  }

  private requireFolder(key: string, reported: string): void {
    if (!this.folders.has(key)) throw appError('notFound', 'No such folder', reported);
  }

  private requireExisting(key: string, reported: string): void {
    if (!this.isTaken(key)) throw appError('notFound', 'No such file or folder', reported);
  }

  private isTaken(key: string): boolean {
    return this.files.has(key) || this.folders.has(key);
  }

  /** First of `name`, `name-1`, `name-2`, … that is not used in the folder. */
  private freePath(folder: string, name: string): string {
    const [stem, extension] = splitExtension(name);
    for (let n = 0; ; n++) {
      const candidate = joinPath(folder, n === 0 ? name : `${stem}-${n}${extension}`);
      if (!this.isTaken(candidate)) return candidate;
    }
  }

  private visibleChildren(folder: string): DirEntry[] {
    const files = [...this.files.keys()]
      .filter((path) => isDirectChild(folder, path) && isListedFile(baseName(path)))
      .map((path): DirEntry => ({ name: baseName(path), path, kind: 'file' }));
    const folders = [...this.folders]
      .filter((path) => isDirectChild(folder, path) && !isHidden(baseName(path)))
      .map((path): DirEntry => ({
        name: baseName(path),
        path,
        kind: 'folder',
        hasChildren: this.hasVisibleChildren(path),
      }));
    return [...files, ...folders];
  }

  private hasVisibleChildren(folder: string): boolean {
    const hasFile = [...this.files.keys()].some(
      (path) => isDirectChild(folder, path) && isListedFile(baseName(path)),
    );
    return (
      hasFile ||
      [...this.folders].some((path) => isDirectChild(folder, path) && !isHidden(baseName(path)))
    );
  }

  private moveTree(source: string, target: string): void {
    const rebase = (path: string) => target + path.slice(source.length);
    for (const [path, file] of [...this.files]) {
      if (isSameOrBelow(source, path)) {
        this.files.delete(path);
        this.files.set(rebase(path), file);
      }
    }
    for (const path of [...this.folders]) {
      if (isSameOrBelow(source, path)) {
        this.folders.delete(path);
        this.folders.add(rebase(path));
      }
    }
  }

  private removeTree(root: string): void {
    for (const path of [...this.files.keys()]) {
      if (isSameOrBelow(root, path)) this.files.delete(path);
    }
    for (const path of [...this.folders]) {
      if (isSameOrBelow(root, path)) this.folders.delete(path);
    }
  }
}
