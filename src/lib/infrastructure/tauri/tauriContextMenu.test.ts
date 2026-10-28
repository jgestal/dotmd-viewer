import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  options: undefined as { items: { id?: string; action?: (id: string) => void }[] } | undefined,
  popup: vi.fn(),
  close: vi.fn(),
}));

vi.mock('@tauri-apps/api/menu', () => ({
  Menu: {
    new: async (options: typeof native.options) => {
      native.options = options;
      return { popup: native.popup, close: native.close };
    },
  },
}));

import { DISMISS_GRACE_MS, tauriContextMenu } from './tauriContextMenu';

const items = [
  { id: 'open', label: 'Open' },
  { id: 'trash', label: 'Trash', enabled: false, separatorBefore: true },
];

beforeEach(() => {
  vi.useFakeTimers();
  native.popup.mockReset().mockResolvedValue(undefined);
  native.close.mockReset().mockResolvedValue(undefined);
});

afterEach(() => vi.useRealTimers());

describe('tauriContextMenu', () => {
  it('builds native items with separators and enabled flags, and pops up at the position', async () => {
    const shown = tauriContextMenu.show(items, { x: 10, y: 20 });
    await vi.advanceTimersByTimeAsync(DISMISS_GRACE_MS);
    await shown;
    expect(native.options?.items).toEqual([
      { id: 'open', text: 'Open', enabled: true, action: expect.any(Function) },
      { item: 'Separator' },
      { id: 'trash', text: 'Trash', enabled: false, action: expect.any(Function) },
    ]);
    expect(native.popup).toHaveBeenCalledWith(expect.objectContaining({ x: 10, y: 20 }));
  });

  it('pops up at the mouse when no position is given', async () => {
    const shown = tauriContextMenu.show(items);
    await vi.advanceTimersByTimeAsync(DISMISS_GRACE_MS);
    await shown;
    expect(native.popup).toHaveBeenCalledWith(undefined);
  });

  it('resolves the id of the chosen item and closes the menu', async () => {
    const shown = tauriContextMenu.show(items);
    await vi.advanceTimersByTimeAsync(0);
    native.options?.items[0].action?.('open');
    expect(await shown).toBe('open');
    expect(native.close).toHaveBeenCalledOnce();
  });

  it('resolves null when nothing is chosen shortly after the menu is dismissed', async () => {
    const shown = tauriContextMenu.show(items);
    await vi.advanceTimersByTimeAsync(DISMISS_GRACE_MS - 1);
    expect(native.close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await shown).toBeNull();
    expect(native.close).toHaveBeenCalledOnce();
  });

  it('reports a native failure as an AppError and still closes the menu', async () => {
    native.popup.mockRejectedValue('menu failed');
    await expect(tauriContextMenu.show(items)).rejects.toMatchObject({ message: 'menu failed' });
    expect(native.close).toHaveBeenCalledOnce();
  });
});
