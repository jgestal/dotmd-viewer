import { describe, expect, it } from 'vitest';
import { rowShortcut } from './rowKeys';

const press = (key: string, modifiers: Partial<Record<string, boolean>> = {}) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers,
});

describe('rowShortcut', () => {
  it('opens the menu with the context-menu key on every platform', () => {
    expect(rowShortcut(press('ContextMenu'), 'windows')).toBe('menu');
    expect(rowShortcut(press('ContextMenu'), 'mac')).toBe('menu');
  });

  it('opens the menu with Shift+F10 only', () => {
    expect(rowShortcut(press('F10', { shiftKey: true }), 'linux')).toBe('menu');
    expect(rowShortcut(press('F10'), 'linux')).toBeNull();
    expect(rowShortcut(press('F10', { shiftKey: true, ctrlKey: true }), 'linux')).toBeNull();
  });

  it('renames with a bare F2', () => {
    expect(rowShortcut(press('F2'), 'mac')).toBe('rename');
    expect(rowShortcut(press('F2', { ctrlKey: true }), 'mac')).toBeNull();
    expect(rowShortcut(press('F2', { shiftKey: true }), 'windows')).toBeNull();
  });

  it('trashes with Delete everywhere and Backspace outside macOS', () => {
    expect(rowShortcut(press('Delete'), 'mac')).toBe('trash');
    expect(rowShortcut(press('Delete'), 'windows')).toBe('trash');
    expect(rowShortcut(press('Backspace'), 'windows')).toBe('trash');
    expect(rowShortcut(press('Backspace'), 'linux')).toBe('trash');
  });

  it('needs Cmd+Backspace on macOS', () => {
    expect(rowShortcut(press('Backspace'), 'mac')).toBeNull();
    expect(rowShortcut(press('Backspace', { metaKey: true }), 'mac')).toBe('trash');
    expect(rowShortcut(press('Backspace', { metaKey: true, shiftKey: true }), 'mac')).toBeNull();
  });

  it('does not trash with Delete while a modifier is held', () => {
    expect(rowShortcut(press('Delete', { altKey: true }), 'linux')).toBeNull();
    expect(rowShortcut(press('Delete', { metaKey: true }), 'mac')).toBeNull();
  });

  it('ignores other keys', () => {
    expect(rowShortcut(press('a'), 'linux')).toBeNull();
    expect(rowShortcut(press('Enter'), 'mac')).toBeNull();
  });
});
