import { describe, expect, it, vi } from 'vitest';
import { activeEditor } from './activeEditor.svelte';

describe('activeEditor', () => {
  const actions = () => ({ find: vi.fn(), replace: vi.fn() });

  it('is empty until an editor registers and again once it withdraws', () => {
    const editor = actions();
    expect(activeEditor.current).toBeNull();
    const withdraw = activeEditor.register(editor);
    expect(activeEditor.current).toBe(editor);
    withdraw();
    expect(activeEditor.current).toBeNull();
  });

  it('does not let a stale editor withdraw its successor', () => {
    const first = actions();
    const second = actions();
    const withdrawFirst = activeEditor.register(first);
    const withdrawSecond = activeEditor.register(second);
    withdrawFirst();
    expect(activeEditor.current).toBe(second);
    withdrawSecond();
  });
});
