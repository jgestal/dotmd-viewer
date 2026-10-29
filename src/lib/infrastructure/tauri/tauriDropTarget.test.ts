import { emit } from '@tauri-apps/api/event';
import { mockWindows } from '@tauri-apps/api/mocks';
import { describe, expect, it, vi } from 'vitest';
import type { DropEvent } from '../../ports';
import { mockBackend, resetMocksAfterEach } from './mockBackend';
import { TauriDropTarget } from './tauriDropTarget';

resetMocksAfterEach();

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
const position = { x: 1, y: 2 };

const listening = async () => {
  mockBackend({});
  mockWindows('main');
  const events: DropEvent[] = [];
  const stop = new TauriDropTarget().onDrag((event) => events.push(event));
  await settle();
  return { events, stop };
};

describe('TauriDropTarget', () => {
  it('reports enter, over, drop and leave, repeating the dragged paths on over', async () => {
    const { events } = await listening();
    await emit('tauri://drag-enter', { paths: ['/a.md'], position });
    await emit('tauri://drag-over', { position });
    await emit('tauri://drag-drop', { paths: ['/a.md', '/b'], position });
    await emit('tauri://drag-leave', {});
    expect(events).toEqual([
      { type: 'enter', paths: ['/a.md'], position },
      { type: 'over', paths: ['/a.md'], position },
      { type: 'drop', paths: ['/a.md', '/b'], position },
      { type: 'leave', paths: [] },
    ]);
  });

  it('converts the physical pointer position to CSS pixels', async () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const { events } = await listening();
    await emit('tauri://drag-drop', { paths: ['/a.png'], position: { x: 300, y: 100 } });
    vi.unstubAllGlobals();
    expect(events).toEqual([{ type: 'drop', paths: ['/a.png'], position: { x: 150, y: 50 } }]);
  });

  it('stops reporting after unsubscribing', async () => {
    const { events, stop } = await listening();
    stop();
    await settle();
    await emit('tauri://drag-enter', { paths: ['/a.md'], position });
    expect(events).toEqual([]);
  });
});
