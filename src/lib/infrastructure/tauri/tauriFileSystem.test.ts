import { describe, expect, it } from 'vitest';
import { describeFileSystemContract } from '../fileSystemContract';
import { MemoryFileSystem } from '../memory';
import { fileCommands, mockBackend, resetMocksAfterEach } from './mockBackend';
import { tauriFileSystem } from './tauriFileSystem';

resetMocksAfterEach();

describeFileSystemContract('TauriFileSystem over a mocked backend', () => {
  const memory = new MemoryFileSystem();
  mockBackend(fileCommands(memory));
  return {
    fileSystem: tauriFileSystem,
    seedFile: (path, content) => memory.seedFile(path, content),
    seedFolder: (path) => memory.seedFolder(path),
  };
});

describe('tauriFileSystem command mapping', () => {
  it('sends each operation to its command with snake_case-ready camelCase arguments', async () => {
    const memory = new MemoryFileSystem();
    memory.seedFile('/d/a.md', 'x');
    memory.seedFolder('/e');
    const calls = mockBackend(fileCommands(memory));

    await tauriFileSystem.readText('/d/a.md');
    await tauriFileSystem.writeText('/d/a.md', { content: 'y', encoding: 'utf-8', hasBom: true });
    await tauriFileSystem.listDir('/d');
    await tauriFileSystem.exists('/d');
    await tauriFileSystem.kind('/d');
    await tauriFileSystem.ensureDir('/e/assets');
    await tauriFileSystem.copyInto('/d/a.md', '/e');
    await tauriFileSystem.rename('/d/a.md', '/d/b.md');
    await tauriFileSystem.reveal('/d/b.md');
    await tauriFileSystem.trash('/d/b.md');

    expect(calls).toEqual([
      { command: 'read_file', args: { path: '/d/a.md' } },
      {
        command: 'write_file',
        args: { path: '/d/a.md', content: 'y', encoding: 'utf-8', hasBom: true },
      },
      { command: 'list_dir', args: { path: '/d' } },
      { command: 'path_exists', args: { path: '/d' } },
      { command: 'path_kind', args: { path: '/d' } },
      { command: 'ensure_dir_path', args: { path: '/e/assets' } },
      { command: 'copy_into', args: { source: '/d/a.md', directory: '/e' } },
      { command: 'rename_path', args: { from: '/d/a.md', to: '/d/b.md' } },
      { command: 'reveal_path', args: { path: '/d/b.md' } },
      { command: 'trash_path', args: { path: '/d/b.md' } },
    ]);
  });

  it('turns a non-AppError rejection into an io AppError', async () => {
    mockBackend({ read_file: () => Promise.reject(new Error('ipc down')) });
    await expect(tauriFileSystem.readText('/a.md')).rejects.toEqual({
      kind: 'io',
      message: 'ipc down',
    });
  });

  it('keeps the kind and path of a rejection coming from Rust', async () => {
    const fromRust = { kind: 'permissionDenied', message: 'nope', path: '/a.md' };
    mockBackend({ read_file: () => Promise.reject(fromRust) });
    await expect(tauriFileSystem.readText('/a.md')).rejects.toEqual(fromRust);
  });
});
