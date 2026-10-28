import { describe, expect, it } from 'vitest';
import { appError } from '../../domain/errors';
import { describeFileSystemContract } from '../fileSystemContract';
import { MemoryFileSystem } from './memoryFileSystem';

describeFileSystemContract('MemoryFileSystem', () => {
  const fs = new MemoryFileSystem();
  return {
    fileSystem: fs,
    seedFile: (path, content) => fs.seedFile(path, content),
    seedFolder: (path) => fs.seedFolder(path),
  };
});

describe('MemoryFileSystem test helpers', () => {
  it('seeds a file with encoding and BOM, creating its folders', async () => {
    const fs = new MemoryFileSystem();
    fs.seedFile('C:\\docs\\a.md', 'x', { encoding: 'windows-1252', hasBom: true });
    expect(await fs.readText('C:/docs/a.md')).toEqual({
      content: 'x',
      encoding: 'windows-1252',
      hasBom: true,
    });
    expect(await fs.exists('C:/docs')).toBe(true);
    expect(await fs.exists('C:/')).toBe(true);
  });

  it('seeds a relative path without looping forever', async () => {
    const fs = new MemoryFileSystem();
    fs.seedFile('a.md', 'x');
    expect(await fs.exists('.')).toBe(true);
  });

  it('fails exactly the next call of the scripted method, then recovers', async () => {
    const fs = new MemoryFileSystem();
    fs.seedFile('/a.md', 'x');
    const error = appError('permissionDenied', 'nope', '/a.md');
    fs.failNext('readText', error);
    await expect(fs.readText('/a.md')).rejects.toBe(error);
    expect((await fs.readText('/a.md')).content).toBe('x');
  });

  it('uses several scripted failures in order and leaves other methods alone', async () => {
    const fs = new MemoryFileSystem();
    fs.seedFile('/a.md', 'x');
    fs.failNext('exists', appError('io', 'first'));
    fs.failNext('exists', appError('io', 'second'));
    expect(await fs.readText('/a.md')).toBeDefined();
    await expect(fs.exists('/a.md')).rejects.toMatchObject({ message: 'first' });
    await expect(fs.exists('/a.md')).rejects.toMatchObject({ message: 'second' });
    expect(await fs.exists('/a.md')).toBe(true);
  });

  it('records trashed and revealed paths, normalised', async () => {
    const fs = new MemoryFileSystem();
    fs.seedFile('/d/a.md', '');
    await fs.reveal('\\d\\a.md');
    await fs.trash('/d/a.md');
    expect(fs.revealed).toEqual(['/d/a.md']);
    expect(fs.trashed).toEqual(['/d/a.md']);
  });

  it('logs every port call with its arguments, failed ones included', async () => {
    const fs = new MemoryFileSystem();
    fs.seedFile('/a.md', '');
    fs.failNext('rename', appError('io', 'x'));
    await fs.exists('/a.md');
    await fs.rename('/a.md', '/b.md').catch(() => undefined);
    expect(fs.calls).toEqual([
      { method: 'exists', args: ['/a.md'] },
      { method: 'rename', args: ['/a.md', '/b.md'] },
    ]);
  });

  it('rejects writing onto a folder with invalidInput', async () => {
    const fs = new MemoryFileSystem();
    fs.seedFolder('/d');
    await expect(
      fs.writeText('/d', { content: '', encoding: 'utf-8', hasBom: false }),
    ).rejects.toMatchObject({ kind: 'invalidInput' });
  });

  it('rejects renaming into a missing folder', async () => {
    const fs = new MemoryFileSystem();
    fs.seedFile('/a.md', '');
    await expect(fs.rename('/a.md', '/none/a.md')).rejects.toMatchObject({ kind: 'notFound' });
  });

  it('rejects copying a folder as if it were a file', async () => {
    const fs = new MemoryFileSystem();
    fs.seedFolder('/src');
    fs.seedFolder('/d');
    await expect(fs.copyInto('/src', '/d')).rejects.toMatchObject({ kind: 'notFound' });
  });

  it('simulateExternalWrite replaces the content, keeps the encoding and notifies subscribers', async () => {
    const fs = new MemoryFileSystem();
    fs.seedFile('/a.md', 'old', { encoding: 'utf-16be', hasBom: true });
    const seen: string[] = [];
    const unsubscribe = fs.onExternalWrite((path) => seen.push(path));
    fs.simulateExternalWrite('\\a.md', 'new');
    unsubscribe();
    fs.simulateExternalWrite('/a.md', 'newer');
    expect(seen).toEqual(['/a.md']);
    expect(await fs.readText('/a.md')).toEqual({
      content: 'newer',
      encoding: 'utf-16be',
      hasBom: true,
    });
  });
});
