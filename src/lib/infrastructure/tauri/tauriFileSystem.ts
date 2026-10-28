import type { DirEntry, EntryKind, FileSystem, TextFile } from '../../ports';
import { call } from './invoke';

/** FileSystem over the Rust commands in files.rs, folders.rs and file_ops.rs. */
export const tauriFileSystem: FileSystem = {
  readText: (path) => call<TextFile>('read_file', { path }),
  writeText: (path, { content, encoding, hasBom }) =>
    call<void>('write_file', { path, content, encoding, hasBom }),
  listDir: (path) => call<readonly DirEntry[]>('list_dir', { path }),
  exists: (path) => call<boolean>('path_exists', { path }),
  kind: (path) => call<EntryKind | 'missing'>('path_kind', { path }),
  rename: (from, to) => call<void>('rename_path', { from, to }),
  trash: (path) => call<void>('trash_path', { path }),
  copyInto: (source, directory) => call<string>('copy_into', { source, directory }),
  reveal: (path) => call<void>('reveal_path', { path }),
};
