import { emit } from '@tauri-apps/api/event';
import { mockWindows } from '@tauri-apps/api/mocks';
import { describe, expect, it } from 'vitest';
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
      { type: 'enter', paths: ['/a.md'] },
      { type: 'over', paths: ['/a.md'] },
      { type: 'drop', paths: ['/a.md', '/b'] },
      { type: 'leave', paths: [] },
    ]);
  });

  it('stops reporting after unsubscribing', async () => {
    const { events, stop } = await listening();
    stop();
    await settle();
    await emit('tauri://drag-enter', { paths: ['/a.md'], position });
    expect(events).toEqual([]);
  });
});
