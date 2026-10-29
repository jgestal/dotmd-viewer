import { describe, expect, it } from 'vitest';
import { appError } from '../domain/errors';
import { createMemoryServices } from '../infrastructure/memory';
import { createImages } from './images';

const setup = () => {
  const services = createMemoryServices();
  services.fs.seedFile('/pics/cat.png', 'png');
  services.fs.seedFile('/pics/my dog (2).JPG', 'jpg');
  services.fs.seedFile('/pics/notes.md', 'text');
  services.fs.seedFolder('/docs');
  const images = createImages({
    fs: services.fs,
    notifier: services.notifier,
    t: services.translate,
  });
  return { ...services, images };
};

describe('importDropped', () => {
  it('copies the image into a new assets folder next to the document and links it', async () => {
    const { images, fs } = setup();
    expect(await images.importDropped('/docs/note.md', ['/pics/cat.png'])).toBe(
      '![cat](assets/cat.png)',
    );
    expect(await fs.kind('/docs/assets')).toBe('folder');
    expect((await fs.readText('/docs/assets/cat.png')).content).toBe('png');
  });

  it('links every image on its own line, escaping the names', async () => {
    const { images } = setup();
    const text = await images.importDropped('/docs/note.md', [
      '/pics/cat.png',
      '/pics/my dog (2).JPG',
    ]);
    expect(text).toBe('![cat](assets/cat.png)\n![my dog (2)](assets/my%20dog%20%282%29.JPG)');
  });

  it('links the name the copy was given when the file name is taken', async () => {
    const { images, fs } = setup();
    fs.seedFile('/docs/assets/cat.png', 'old');
    expect(await images.importDropped('/docs/note.md', ['/pics/cat.png'])).toBe(
      '![cat-1](assets/cat-1.png)',
    );
    expect((await fs.readText('/docs/assets/cat.png')).content).toBe('old');
  });

  it('ignores files that are not images and does not touch the disk when none is', async () => {
    const { images, fs, notifier } = setup();
    expect(await images.importDropped('/docs/note.md', ['/pics/notes.md'])).toBeNull();
    expect(fs.calls).toEqual([]);
    expect(notifier.errors).toEqual([]);
  });

  it('copies only the images of a mixed drop', async () => {
    const { images } = setup();
    expect(await images.importDropped('/docs/note.md', ['/pics/notes.md', '/pics/cat.png'])).toBe(
      '![cat](assets/cat.png)',
    );
  });

  it('asks to save an untitled document first and copies nothing', async () => {
    const { images, fs, notifier } = setup();
    expect(await images.importDropped(null, ['/pics/cat.png'])).toBeNull();
    expect(notifier.errors).toEqual(['images.saveFirst']);
    expect(fs.calls).toEqual([]);
  });

  it('reports a failing copy and still links the other images', async () => {
    const { images, fs, notifier } = setup();
    fs.failNext('copyInto', appError('permissionDenied', 'Permission denied'));
    const text = await images.importDropped('/docs/note.md', [
      '/pics/cat.png',
      '/pics/my dog (2).JPG',
    ]);
    expect(text).toBe('![my dog (2)](assets/my%20dog%20%282%29.JPG)');
    expect(notifier.errors).toEqual([
      'images.copyFailed {"name":"cat.png","reason":"Permission denied"}',
    ]);
  });

  it('returns nothing when no image could be copied', async () => {
    const { images, notifier } = setup();
    expect(await images.importDropped('/docs/note.md', ['/pics/missing.png'])).toBeNull();
    expect(notifier.errors).toHaveLength(1);
  });

  it('reports a folder that cannot be created and copies nothing', async () => {
    const { images, fs, notifier } = setup();
    fs.failNext('ensureDir', appError('permissionDenied', 'Permission denied', '/docs/assets'));
    expect(await images.importDropped('/docs/note.md', ['/pics/cat.png'])).toBeNull();
    expect(notifier.errors).toEqual(['Permission denied']);
    expect(await fs.exists('/docs/assets/cat.png')).toBe(false);
  });
});
