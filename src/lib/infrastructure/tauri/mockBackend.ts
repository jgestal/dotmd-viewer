// Test support: a fake Rust side behind `invoke`, built on @tauri-apps/api/mocks.
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import { afterEach } from 'vitest';
import type { MemoryFileSystem } from '../memory';

export interface InvokeRecord {
  readonly command: string;
  readonly args: Record<string, unknown>;
}

export type CommandHandlers = Record<string, (args: Record<string, unknown>) => unknown>;

/** Answers each command with its handler (unknown commands reject) and records every call. */
export const mockBackend = (handlers: CommandHandlers): InvokeRecord[] => {
  const records: InvokeRecord[] = [];
  mockIPC(
    (command, payload) => {
      const args = (payload ?? {}) as Record<string, unknown>;
      records.push({ command, args });
      const handler = handlers[command];
      if (handler === undefined) return Promise.reject(new Error(`unexpected command ${command}`));
      return handler(args);
    },
    { shouldMockEvents: true },
  );
  return records;
};

/** The file commands of the Rust side, served by a MemoryFileSystem. */
export const fileCommands = (fs: MemoryFileSystem): CommandHandlers => ({
  read_file: ({ path }) => fs.readText(path as string),
  read_file_base64: ({ path, maxBytes }) => fs.readBase64(path as string, maxBytes as number),
  write_file: ({ path, content, encoding, hasBom }) =>
    fs.writeText(path as string, { content, encoding, hasBom } as never),
  list_dir: ({ path }) => fs.listDir(path as string),
  path_exists: ({ path }) => fs.exists(path as string),
  path_kind: ({ path }) => fs.kind(path as string),
  rename_path: ({ from, to }) => fs.rename(from as string, to as string),
  trash_path: ({ path }) => fs.trash(path as string),
  ensure_dir_path: ({ path }) => fs.ensureDir(path as string),
  copy_into: ({ source, directory }) => fs.copyInto(source as string, directory as string),
  reveal_path: ({ path }) => fs.reveal(path as string),
});

/** Registers the cleanup every test that mocks IPC needs. */
export const resetMocksAfterEach = (): void => {
  afterEach(() => clearMocks());
};
