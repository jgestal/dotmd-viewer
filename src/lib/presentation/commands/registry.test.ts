import { describe, expect, it, vi } from 'vitest';
import { COMMAND_IDS, defaultAccelerators } from './ids';
import { createRegistry, type Command, type KeyboardEventLike } from './registry';
import { parseAccelerator, resolveAccelerator, type Platform } from './shortcuts';

const command = (overrides: Partial<Command> & Pick<Command, 'id'>): Command => ({
  label: `label.${overrides.id}`,
  run: () => {},
  ...overrides,
});

const keyEvent = (overrides: Partial<KeyboardEventLike>): KeyboardEventLike => ({
  key: '',
  code: '',
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...overrides,
});

describe('createRegistry', () => {
  it('gets a command by id and lists all in order', () => {
    const save = command({ id: 'file.save' });
    const open = command({ id: 'file.open' });
    const registry = createRegistry([save, open]);
    expect(registry.get('file.open')).toBe(open);
    expect(registry.get('file.new')).toBeUndefined();
    expect(registry.all()).toEqual([save, open]);
  });

  it('executes a command and awaits async actions', async () => {
    let done = false;
    const run = async () => {
      await Promise.resolve();
      done = true;
    };
    await createRegistry([command({ id: 'file.save', run })]).execute('file.save');
    expect(done).toBe(true);
  });

  it('executes a command whose enabled() returns true', async () => {
    const run = vi.fn();
    await createRegistry([command({ id: 'file.save', run, enabled: () => true })]).execute(
      'file.save',
    );
    expect(run).toHaveBeenCalledOnce();
  });

  it('does nothing for a disabled command', async () => {
    const run = vi.fn();
    await createRegistry([command({ id: 'file.save', run, enabled: () => false })]).execute(
      'file.save',
    );
    expect(run).not.toHaveBeenCalled();
  });

  it('does nothing for an unknown command', async () => {
    await expect(createRegistry([]).execute('file.save')).resolves.toBeUndefined();
  });

  describe('findByEvent', () => {
    const registry = createRegistry([
      command({ id: 'file.save', accelerator: 'Mod+S' }),
      command({ id: 'view.fullScreen', accelerator: { mac: 'Ctrl+Mod+F', other: 'F11' } }),
      command({ id: 'help.about' }),
      command({ id: 'view.zoomIn', accelerator: { mac: 'Mod+=' } }),
    ]);

    it('finds the command by its accelerator', () => {
      const event = keyEvent({ key: 's', code: 'KeyS', metaKey: true });
      expect(registry.findByEvent(event, 'mac')?.id).toBe('file.save');
    });

    it('resolves per-platform accelerators', () => {
      const f11 = keyEvent({ key: 'F11', code: 'F11' });
      expect(registry.findByEvent(f11, 'linux')?.id).toBe('view.fullScreen');
      expect(registry.findByEvent(f11, 'mac')).toBeUndefined();
      const ctrlCmdF = keyEvent({ key: 'f', code: 'KeyF', metaKey: true, ctrlKey: true });
      expect(registry.findByEvent(ctrlCmdF, 'mac')?.id).toBe('view.fullScreen');
    });

    it('skips platforms without an accelerator', () => {
      const ctrlEqual = keyEvent({ key: '=', code: 'Equal', ctrlKey: true });
      expect(registry.findByEvent(ctrlEqual, 'windows')).toBeUndefined();
    });

    it('returns undefined when nothing matches', () => {
      expect(registry.findByEvent(keyEvent({ key: 'x', metaKey: true }), 'mac')).toBeUndefined();
    });

    it('ignores events during an IME composition', () => {
      const event = keyEvent({ key: 's', code: 'KeyS', metaKey: true, isComposing: true });
      expect(registry.findByEvent(event, 'mac')).toBeUndefined();
    });

    it('still finds commands when isComposing is false', () => {
      const event = keyEvent({ key: 's', code: 'KeyS', metaKey: true, isComposing: false });
      expect(registry.findByEvent(event, 'mac')?.id).toBe('file.save');
    });
  });
});

describe('defaultAccelerators', () => {
  const platforms: Platform[] = ['mac', 'windows', 'linux'];

  it('lists every command id exactly once', () => {
    expect(new Set(COMMAND_IDS).size).toBe(COMMAND_IDS.length);
    expect(COMMAND_IDS).toHaveLength(32);
  });

  it('only assigns accelerators to known commands and they all parse', () => {
    for (const [id, spec] of Object.entries(defaultAccelerators)) {
      expect(COMMAND_IDS).toContain(id);
      for (const platform of platforms) {
        const accelerator = resolveAccelerator(spec, platform);
        expect(accelerator === undefined || parseAccelerator(accelerator) !== null).toBe(true);
      }
    }
  });

  it.each(platforms)('gives no two commands the same accelerator on %s', (platform) => {
    const used = Object.values(defaultAccelerators)
      .map((spec) => resolveAccelerator(spec, platform))
      .filter((accelerator) => accelerator !== undefined);
    expect(new Set(used).size).toBe(used.length);
  });

  it('binds Quit to Mod+Q everywhere except Windows', () => {
    const quit = defaultAccelerators['app.quit']!;
    expect(resolveAccelerator(quit, 'mac')).toBe('Mod+Q');
    expect(resolveAccelerator(quit, 'linux')).toBe('Mod+Q');
    expect(resolveAccelerator(quit, 'windows')).toBeUndefined();
  });

  it('uses the platform specific full screen shortcut', () => {
    expect(defaultAccelerators['view.fullScreen']).toEqual({ mac: 'Ctrl+Mod+F', other: 'F11' });
  });
});
