import { describe, expect, it } from 'vitest';
import { createMemoryServices } from '../infrastructure/memory';
import { createDrop } from './drop';

const setup = () => {
  const services = createMemoryServices();
  services.fs.seedFile('/d/a.md', '');
  services.fs.seedFile('/d/b.txt', '');
  services.fs.seedFile('/d/c.MARKDOWN', '');
  services.fs.seedFile('/d/pic.png', '');
  services.fs.seedFolder('/d/sub');
  services.fs.seedFolder('/other');
  const drop = createDrop({ fs: services.fs, notifier: services.notifier, t: services.translate });
  return { ...services, drop };
};

describe('plan', () => {
  it('opens a single Markdown file without a message', async () => {
    const { drop, notifier } = setup();
    expect(await drop.plan(['/d/a.md'])).toEqual({ folder: null, file: '/d/a.md' });
    expect(notifier.infos).toEqual([]);
    expect(notifier.errors).toEqual([]);
  });

  it('opens a folder as the explorer root', async () => {
    const { drop, notifier } = setup();
    expect(await drop.plan(['/d/sub'])).toEqual({ folder: '/d/sub', file: null });
    expect(notifier.infos).toEqual([]);
  });

  it('opens the last Markdown file and says how many items were skipped', async () => {
    const { drop, notifier } = setup();
    const plan = await drop.plan(['/d/a.md', '/d/c.MARKDOWN', '/d/b.txt']);
    expect(plan).toEqual({ folder: null, file: '/d/b.txt' });
    expect(notifier.infos).toEqual(['drop.skipped {"name":"b.txt","count":2}']);
  });

  it('opens both the last folder and the last file when both are dropped', async () => {
    const { drop, notifier } = setup();
    const plan = await drop.plan(['/other', '/d/a.md', '/d/sub']);
    expect(plan).toEqual({ folder: '/d/sub', file: '/d/a.md' });
    expect(notifier.infos).toEqual(['drop.skipped {"name":"a.md","count":1}']);
  });

  it('names the folder when only folders are skipped', async () => {
    const { drop, notifier } = setup();
    await drop.plan(['/other', '/d/sub']);
    expect(notifier.infos).toEqual(['drop.skipped {"name":"sub","count":1}']);
  });

  it('skips unsupported and missing paths while opening the rest', async () => {
    const { drop, notifier } = setup();
    const plan = await drop.plan(['/d/pic.png', '/d/a.md', '/d/gone.md']);
    expect(plan).toEqual({ folder: null, file: '/d/a.md' });
    expect(notifier.infos).toEqual(['drop.skipped {"name":"a.md","count":2}']);
  });

  it('rejects with an error when nothing can be opened', async () => {
    const { drop, notifier } = setup();
    expect(await drop.plan(['/d/pic.png', '/d/gone.md'])).toEqual({ folder: null, file: null });
    expect(notifier.errors).toEqual(['drop.rejected']);
    expect(notifier.infos).toEqual([]);
  });

  it('does nothing for an empty drop', async () => {
    const { drop, notifier } = setup();
    expect(await drop.plan([])).toEqual({ folder: null, file: null });
    expect(notifier.errors).toEqual([]);
  });
});
