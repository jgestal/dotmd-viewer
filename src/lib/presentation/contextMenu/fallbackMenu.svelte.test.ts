import { afterEach, describe, expect, it } from 'vitest';
import { closeFallbackMenu, fallbackContextMenu, fallbackMenuState } from './fallbackMenu.svelte';

const items = [{ id: 'open', label: 'Open' }];

afterEach(() => closeFallbackMenu(null));

describe('fallbackContextMenu', () => {
  it('shows the items at the position and resolves the chosen id', async () => {
    const shown = fallbackContextMenu.show(items, { x: 5, y: 7 });
    expect(fallbackMenuState.open?.items).toEqual(items);
    expect(fallbackMenuState.open?.at).toEqual({ x: 5, y: 7 });
    closeFallbackMenu('open');
    expect(await shown).toBe('open');
    expect(fallbackMenuState.open).toBeNull();
  });

  it('resolves null when it is closed without a choice', async () => {
    const shown = fallbackContextMenu.show(items);
    expect(fallbackMenuState.open?.at).toEqual({ x: 0, y: 0 });
    closeFallbackMenu(null);
    expect(await shown).toBeNull();
  });

  it('dismisses the menu that was open when another is requested', async () => {
    const first = fallbackContextMenu.show(items);
    const second = fallbackContextMenu.show([{ id: 'x', label: 'X' }]);
    expect(await first).toBeNull();
    closeFallbackMenu('x');
    expect(await second).toBe('x');
  });

  it('ignores a close when nothing is open', () => {
    expect(() => closeFallbackMenu(null)).not.toThrow();
  });
});
