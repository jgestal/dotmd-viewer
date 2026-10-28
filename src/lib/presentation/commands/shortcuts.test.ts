import { describe, expect, it } from 'vitest';
import {
  formatAccelerator,
  matchesEvent,
  parseAccelerator,
  resolveAccelerator,
  toTauriAccelerator,
  type KeyEventLike,
} from './shortcuts';

const event = (overrides: Partial<KeyEventLike>): KeyEventLike => ({
  key: '',
  code: '',
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...overrides,
});

describe('parseAccelerator', () => {
  it('parses modifiers and an upper-cased key', () => {
    expect(parseAccelerator('Mod+Shift+s')).toEqual({
      mod: true,
      ctrl: false,
      alt: false,
      shift: true,
      key: 'S',
    });
  });

  it('parses every modifier', () => {
    expect(parseAccelerator('Ctrl+Mod+Alt+Shift+F')).toEqual({
      mod: true,
      ctrl: true,
      alt: true,
      shift: true,
      key: 'F',
    });
  });

  it.each(['F11', 'F1', 'F24', 'Mod+1', 'Mod+\\', 'Mod+=', 'Mod+-', 'Mod+,', 'Mod+0'])(
    'accepts %s',
    (text) => expect(parseAccelerator(text)).not.toBeNull(),
  );

  it.each(['', 'Mod+', 'Mod+Hyper+S', 'Mod+Esc', 'F25', 'F0', 'Mod+SS', 'mod+S'])(
    'rejects %j',
    (text) => expect(parseAccelerator(text)).toBeNull(),
  );
});

describe('matchesEvent', () => {
  it('maps Mod to Cmd on macOS', () => {
    const cmdS = event({ key: 's', code: 'KeyS', metaKey: true });
    expect(matchesEvent('Mod+S', cmdS, 'mac')).toBe(true);
    expect(matchesEvent('Mod+S', { ...cmdS, metaKey: false, ctrlKey: true }, 'mac')).toBe(false);
  });

  it.each(['windows', 'linux'] as const)('maps Mod to Ctrl on %s', (platform) => {
    const ctrlS = event({ key: 's', code: 'KeyS', ctrlKey: true });
    expect(matchesEvent('Mod+S', ctrlS, platform)).toBe(true);
    expect(matchesEvent('Mod+S', { ...ctrlS, ctrlKey: false, metaKey: true }, platform)).toBe(
      false,
    );
  });

  it('matches letters case-insensitively', () => {
    expect(
      matchesEvent('Mod+Shift+S', event({ key: 'S', metaKey: true, shiftKey: true }), 'mac'),
    ).toBe(true);
  });

  it('requires the exact modifiers', () => {
    const cmdS = event({ key: 's', metaKey: true });
    expect(matchesEvent('Mod+S', { ...cmdS, shiftKey: true }, 'mac')).toBe(false);
    expect(matchesEvent('Mod+S', { ...cmdS, altKey: true }, 'mac')).toBe(false);
    expect(matchesEvent('Mod+Shift+S', cmdS, 'mac')).toBe(false);
    expect(matchesEvent('Mod+Alt+S', cmdS, 'mac')).toBe(false);
    expect(matchesEvent('S', cmdS, 'mac')).toBe(false);
  });

  it('matches a different letter as false', () => {
    expect(matchesEvent('Mod+S', event({ key: 'a', code: 'KeyA', metaKey: true }), 'mac')).toBe(
      false,
    );
  });

  it('matches Alt letters by physical key when Alt changes the character', () => {
    const altF = event({ key: 'ƒ', code: 'KeyF', metaKey: true, altKey: true });
    expect(matchesEvent('Mod+Alt+F', altF, 'mac')).toBe(true);
    expect(matchesEvent('Mod+F', { ...altF, altKey: false }, 'mac')).toBe(false);
  });

  it('matches digits by code so Shift does not break them', () => {
    const shiftOne = event({ key: '!', code: 'Digit1', metaKey: true, shiftKey: true });
    expect(matchesEvent('Mod+Shift+1', shiftOne, 'mac')).toBe(true);
    expect(matchesEvent('Mod+Shift+2', shiftOne, 'mac')).toBe(false);
  });

  it('matches numpad digits', () => {
    expect(
      matchesEvent('Mod+1', event({ key: '1', code: 'Numpad1', ctrlKey: true }), 'linux'),
    ).toBe(true);
  });

  it('matches punctuation by code on a Spanish layout', () => {
    expect(
      matchesEvent('Mod+\\', event({ key: 'º', code: 'Backslash', ctrlKey: true }), 'windows'),
    ).toBe(true);
    expect(matchesEvent('Mod+=', event({ key: '¡', code: 'Equal', metaKey: true }), 'mac')).toBe(
      true,
    );
    expect(matchesEvent('Mod+-', event({ key: '-', code: 'Minus', metaKey: true }), 'mac')).toBe(
      true,
    );
    expect(matchesEvent('Mod+,', event({ key: ',', code: 'Comma', metaKey: true }), 'mac')).toBe(
      true,
    );
    expect(matchesEvent('Mod+-', event({ key: '-', code: 'Equal', metaKey: true }), 'mac')).toBe(
      false,
    );
  });

  it('matches function keys without modifiers', () => {
    expect(matchesEvent('F11', event({ key: 'F11', code: 'F11' }), 'windows')).toBe(true);
    expect(matchesEvent('F11', event({ key: 'F12', code: 'F12' }), 'windows')).toBe(false);
  });

  it('distinguishes the explicit Ctrl modifier from Mod on macOS', () => {
    const ctrlCmdF = event({ key: 'f', metaKey: true, ctrlKey: true });
    expect(matchesEvent('Ctrl+Mod+F', ctrlCmdF, 'mac')).toBe(true);
    expect(matchesEvent('Mod+F', ctrlCmdF, 'mac')).toBe(false);
  });

  it('treats Ctrl and Mod as the same key outside macOS', () => {
    expect(matchesEvent('Ctrl+Mod+F', event({ key: 'f', ctrlKey: true }), 'linux')).toBe(true);
    expect(matchesEvent('Ctrl+F', event({ key: 'f', ctrlKey: true }), 'windows')).toBe(true);
  });

  it('never matches an invalid accelerator', () => {
    expect(matchesEvent('nonsense', event({ key: 's', metaKey: true }), 'mac')).toBe(false);
  });
});

describe('formatAccelerator', () => {
  it('uses symbols on macOS', () => {
    expect(formatAccelerator('Mod+Shift+S', 'mac')).toBe('⌘⇧S');
    expect(formatAccelerator('Mod+Alt+F', 'mac')).toBe('⌘⌥F');
    expect(formatAccelerator('Ctrl+Mod+F', 'mac')).toBe('⌃⌘F');
    expect(formatAccelerator('F11', 'mac')).toBe('F11');
  });

  it('uses names elsewhere', () => {
    expect(formatAccelerator('Mod+Shift+S', 'windows')).toBe('Ctrl+Shift+S');
    expect(formatAccelerator('Mod+Alt+1', 'linux')).toBe('Ctrl+Alt+1');
    expect(formatAccelerator('Ctrl+Mod+F', 'linux')).toBe('Ctrl+F');
    expect(formatAccelerator('Ctrl+F', 'windows')).toBe('Ctrl+F');
    expect(formatAccelerator('F11', 'windows')).toBe('F11');
    expect(formatAccelerator('Mod+\\', 'windows')).toBe('Ctrl+\\');
  });

  it('returns invalid text unchanged', () => {
    expect(formatAccelerator('nonsense', 'mac')).toBe('nonsense');
  });
});

describe('toTauriAccelerator', () => {
  it('converts Mod to CmdOrCtrl', () => {
    expect(toTauriAccelerator('Mod+Shift+S')).toBe('CmdOrCtrl+Shift+S');
    expect(toTauriAccelerator('Mod+Alt+1')).toBe('CmdOrCtrl+Alt+1');
    expect(toTauriAccelerator('Mod+\\')).toBe('CmdOrCtrl+\\');
  });

  it('keeps Ctrl and orders modifiers', () => {
    expect(toTauriAccelerator('Shift+Alt+Mod+Ctrl+F')).toBe('Ctrl+CmdOrCtrl+Alt+Shift+F');
    expect(toTauriAccelerator('F11')).toBe('F11');
  });

  it('returns invalid text unchanged', () => {
    expect(toTauriAccelerator('nonsense')).toBe('nonsense');
  });
});

describe('resolveAccelerator', () => {
  it('returns a plain accelerator for every platform', () => {
    expect(resolveAccelerator('Mod+S', 'mac')).toBe('Mod+S');
    expect(resolveAccelerator('Mod+S', 'linux')).toBe('Mod+S');
  });

  it('picks the per-platform accelerator', () => {
    const spec = { mac: 'Ctrl+Mod+F', other: 'F11' };
    expect(resolveAccelerator(spec, 'mac')).toBe('Ctrl+Mod+F');
    expect(resolveAccelerator(spec, 'windows')).toBe('F11');
    expect(resolveAccelerator(spec, 'linux')).toBe('F11');
  });

  it('lets Windows override or drop the shared accelerator', () => {
    expect(resolveAccelerator({ other: 'Mod+Q', windows: 'Alt+F4' }, 'windows')).toBe('Alt+F4');
    expect(resolveAccelerator({ other: 'Mod+Q', windows: null }, 'windows')).toBeUndefined();
    expect(resolveAccelerator({ other: 'Mod+Q', windows: null }, 'linux')).toBe('Mod+Q');
  });

  it('returns undefined when the platform has none', () => {
    expect(resolveAccelerator({ mac: 'Mod+K' }, 'linux')).toBeUndefined();
    expect(resolveAccelerator({ other: 'F11' }, 'mac')).toBeUndefined();
  });
});
