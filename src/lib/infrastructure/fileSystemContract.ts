// The behaviour every FileSystem adapter must show: the in-memory double and, in T22, the Tauri
// adapter over a mocked backend. Run it with `describeFileSystemContract(name, factory)`.
import { describe, expect, it } from 'vitest';
import { isAppError } from '../domain/errors';
import type { ErrorKind } from '../domain/errors';
import type { FileSystem } from '../ports';

/** A file system under test plus the means to prepare its contents. */
export interface FileSystemFixture {
  readonly fileSystem: FileSystem;
  /** Creates the file (and its folders) with UTF-8 content. */
  seedFile(path: string, content: string): void;
  seedFolder(path: string): void;
}

const rejectionKind = async (action: Promise<unknown>): Promise<ErrorKind | 'resolved'> => {
  try {
    await action;
    return 'resolved';
  } catch (thrown) {
    if (!isAppError(thrown)) throw thrown;
    return thrown.kind;
  }
};

const names = async (fileSystem: FileSystem, path: string): Promise<string[]> =>
  (await fileSystem.listDir(path)).map((entry) => entry.name);

export function describeFileSystemContract(name: string, factory: () => FileSystemFixture): void {
  describe(`${name} satisfies the FileSystem contract`, () => {
    describe('readText and writeText', () => {
      it('reads back what was written, with encoding and BOM', async () => {
        const { fileSystem, seedFolder } = factory();
        seedFolder('/docs');
        const file = { content: 'héllo\n', encoding: 'utf-16le', hasBom: true } as const;
        await fileSystem.writeText('/docs/a.md', file);
        expect(await fileSystem.readText('/docs/a.md')).toEqual(file);
      });

      it('rejects with notFound when the file is missing, naming the path', async () => {
        const { fileSystem } = factory();
        await expect(fileSystem.readText('/docs/missing.md')).rejects.toMatchObject({
          kind: 'notFound',
          path: '/docs/missing.md',
        });
      });

      it('rejects with notFound when writing into a missing folder', async () => {
        const { fileSystem } = factory();
        const write = fileSystem.writeText('/nowhere/a.md', {
          content: '',
          encoding: 'utf-8',
          hasBom: false,
        });
        expect(await rejectionKind(write)).toBe('notFound');
      });

      it('treats backslashes and repeated separators as the same path', async () => {
        const { fileSystem, seedFile } = factory();
        seedFile('/docs/a.md', 'x');
        expect((await fileSystem.readText('\\docs\\\\a.md')).content).toBe('x');
      });
    });

    describe('exists', () => {
      it('is true for files and folders and false otherwise', async () => {
        const { fileSystem, seedFile } = factory();
        seedFile('/docs/a.md', 'x');
        expect(await fileSystem.exists('/docs/a.md')).toBe(true);
        expect(await fileSystem.exists('/docs')).toBe(true);
        expect(await fileSystem.exists('/docs/b.md')).toBe(false);
      });
    });

    describe('kind', () => {
      it('tells files, folders and missing paths apart', async () => {
        const { fileSystem, seedFile } = factory();
        seedFile('/docs/a.md', 'x');
        expect(await fileSystem.kind('/docs/a.md')).toBe('file');
        expect(await fileSystem.kind('/docs')).toBe('folder');
        expect(await fileSystem.kind('/docs/b.md')).toBe('missing');
      });
    });

    describe('listDir', () => {
      it('lists only Markdown and text files and folders, without hidden entries', async () => {
        const { fileSystem, seedFile, seedFolder } = factory();
        seedFile('/d/a.md', '');
        seedFile('/d/b.markdown', '');
        seedFile('/d/c.txt', '');
        seedFile('/d/image.png', '');
        seedFile('/d/.hidden.md', '');
        seedFolder('/d/.git');
        seedFolder('/d/sub');
        expect(await names(fileSystem, '/d')).toEqual(['sub', 'a.md', 'b.markdown', 'c.txt']);
      });

      it('puts folders first and sorts naturally, ignoring case', async () => {
        const { fileSystem, seedFile, seedFolder } = factory();
        seedFile('/d/note10.md', '');
        seedFile('/d/Note2.md', '');
        seedFile('/d/apple.md', '');
        seedFolder('/d/zeta');
        seedFolder('/d/Alpha');
        expect(await names(fileSystem, '/d')).toEqual([
          'Alpha',
          'zeta',
          'apple.md',
          'Note2.md',
          'note10.md',
        ]);
      });

      it('reports full paths and kinds', async () => {
        const { fileSystem, seedFile, seedFolder } = factory();
        seedFolder('/d/sub');
        seedFile('/d/a.md', '');
        expect(await fileSystem.listDir('/d/')).toEqual([
          { name: 'sub', path: '/d/sub', kind: 'folder', hasChildren: false },
          { name: 'a.md', path: '/d/a.md', kind: 'file' },
        ]);
      });

      it('says whether a folder has anything visible inside', async () => {
        const { fileSystem, seedFile, seedFolder } = factory();
        seedFile('/d/full/a.md', '');
        seedFolder('/d/nested/inner');
        seedFile('/d/onlyOther/image.png', '');
        seedFile('/d/onlyHidden/.secret.md', '');
        const entries = await fileSystem.listDir('/d');
        const hasChildren = Object.fromEntries(entries.map((e) => [e.name, e.hasChildren]));
        expect(hasChildren).toEqual({
          full: true,
          nested: true,
          onlyOther: false,
          onlyHidden: false,
        });
      });

      it('rejects with notFound for a missing folder and invalidInput for a file', async () => {
        const { fileSystem, seedFile } = factory();
        seedFile('/d/a.md', '');
        expect(await rejectionKind(fileSystem.listDir('/missing'))).toBe('notFound');
        expect(await rejectionKind(fileSystem.listDir('/d/a.md'))).toBe('invalidInput');
      });
    });

    describe('rename', () => {
      it('moves a file', async () => {
        const { fileSystem, seedFile } = factory();
        seedFile('/d/a.md', 'x');
        await fileSystem.rename('/d/a.md', '/d/b.md');
        expect(await fileSystem.exists('/d/a.md')).toBe(false);
        expect((await fileSystem.readText('/d/b.md')).content).toBe('x');
      });

      it('moves a folder together with its descendants', async () => {
        const { fileSystem, seedFile, seedFolder } = factory();
        seedFile('/d/old/a.md', 'a');
        seedFile('/d/old/deep/b.md', 'b');
        seedFolder('/d/old/empty');
        await fileSystem.rename('/d/old', '/d/new');
        expect(await fileSystem.exists('/d/old')).toBe(false);
        expect((await fileSystem.readText('/d/new/a.md')).content).toBe('a');
        expect((await fileSystem.readText('/d/new/deep/b.md')).content).toBe('b');
        expect(await fileSystem.exists('/d/new/empty')).toBe(true);
      });

      it('does not move a folder’s sibling that merely shares its name prefix', async () => {
        const { fileSystem, seedFile } = factory();
        seedFile('/d/a/x.md', '');
        seedFile('/d/ab/y.md', '');
        await fileSystem.rename('/d/a', '/d/c');
        expect(await fileSystem.exists('/d/ab/y.md')).toBe(true);
      });

      it('rejects with alreadyExists rather than overwrite, and changes nothing', async () => {
        const { fileSystem, seedFile, seedFolder } = factory();
        seedFile('/d/a.md', 'a');
        seedFile('/d/b.md', 'b');
        seedFolder('/d/folder');
        expect(await rejectionKind(fileSystem.rename('/d/a.md', '/d/b.md'))).toBe('alreadyExists');
        expect(await rejectionKind(fileSystem.rename('/d/a.md', '/d/folder'))).toBe(
          'alreadyExists',
        );
        expect((await fileSystem.readText('/d/a.md')).content).toBe('a');
        expect((await fileSystem.readText('/d/b.md')).content).toBe('b');
      });

      it('rejects with notFound when the source is missing', async () => {
        const { fileSystem, seedFolder } = factory();
        seedFolder('/d');
        expect(await rejectionKind(fileSystem.rename('/d/a.md', '/d/b.md'))).toBe('notFound');
      });
    });

    describe('trash', () => {
      it('removes a file, and a folder with everything in it', async () => {
        const { fileSystem, seedFile } = factory();
        seedFile('/d/a.md', '');
        seedFile('/d/sub/b.md', '');
        await fileSystem.trash('/d/a.md');
        await fileSystem.trash('/d/sub');
        expect(await fileSystem.exists('/d/a.md')).toBe(false);
        expect(await fileSystem.exists('/d/sub')).toBe(false);
        expect(await fileSystem.exists('/d/sub/b.md')).toBe(false);
      });

      it('rejects with notFound when there is nothing to trash', async () => {
        const { fileSystem } = factory();
        expect(await rejectionKind(fileSystem.trash('/d/a.md'))).toBe('notFound');
      });
    });

    describe('copyInto', () => {
      it('copies under the same name when it is free and returns the new path', async () => {
        const { fileSystem, seedFile, seedFolder } = factory();
        seedFile('/src/img.png', 'bytes');
        seedFolder('/d');
        expect(await fileSystem.copyInto('/src/img.png', '/d')).toBe('/d/img.png');
        expect((await fileSystem.readText('/d/img.png')).content).toBe('bytes');
      });

      it('picks the first free name: img-1.png, img-2.png, …', async () => {
        const { fileSystem, seedFile } = factory();
        seedFile('/src/img.png', 'new');
        seedFile('/d/img.png', 'old');
        expect(await fileSystem.copyInto('/src/img.png', '/d')).toBe('/d/img-1.png');
        expect(await fileSystem.copyInto('/src/img.png', '/d')).toBe('/d/img-2.png');
        expect((await fileSystem.readText('/d/img.png')).content).toBe('old');
      });

      it('appends the number to a name without extension', async () => {
        const { fileSystem, seedFile } = factory();
        seedFile('/src/LICENSE', 'x');
        seedFile('/d/LICENSE', 'y');
        expect(await fileSystem.copyInto('/src/LICENSE', '/d')).toBe('/d/LICENSE-1');
      });

      it('rejects with notFound for a missing source or directory', async () => {
        const { fileSystem, seedFile, seedFolder } = factory();
        seedFile('/src/img.png', '');
        seedFolder('/d');
        expect(await rejectionKind(fileSystem.copyInto('/src/none.png', '/d'))).toBe('notFound');
        expect(await rejectionKind(fileSystem.copyInto('/src/img.png', '/none'))).toBe('notFound');
      });
    });

    describe('reveal', () => {
      it('resolves for an existing path and rejects with notFound otherwise', async () => {
        const { fileSystem, seedFile } = factory();
        seedFile('/d/a.md', '');
        expect(await rejectionKind(fileSystem.reveal('/d/a.md'))).toBe('resolved');
        expect(await rejectionKind(fileSystem.reveal('/d/none.md'))).toBe('notFound');
      });
    });
  });
}
