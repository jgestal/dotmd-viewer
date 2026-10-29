import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { DragController, readHit, type DragActions } from './dragController.svelte';
import type { DragSource } from './dragMove';

const source: DragSource = { kind: 'entry', path: '/w/a.md', entryKind: 'file' };

const zone = (attributes: Record<string, string>): HTMLElement => {
  const element = document.createElement('div');
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  return element;
};

const pointer = (type: string, x = 0, y = 0, button = 0) =>
  new MouseEvent(type, { clientX: x, clientY: y, button, bubbles: true });

describe('readHit', () => {
  it('reads each kind of drop zone', () => {
    expect(
      readHit(zone({ 'data-drop': 'row', 'data-path': '/w/d', 'data-kind': 'folder' })),
    ).toEqual({
      zone: 'row',
      path: '/w/d',
      entryKind: 'folder',
    });
    expect(
      readHit(zone({ 'data-drop': 'row', 'data-path': '/w/a.md', 'data-kind': 'file' })),
    ).toEqual({
      zone: 'row',
      path: '/w/a.md',
      entryKind: 'file',
    });
    expect(readHit(zone({ 'data-drop': 'root', 'data-path': '/w' }))).toEqual({
      zone: 'root',
      path: '/w',
    });
    expect(readHit(zone({ 'data-drop': 'favourites' }))).toEqual({ zone: 'favourites' });
    expect(readHit(zone({ 'data-drop': 'favourite', 'data-index': '3' }))).toEqual({
      zone: 'favourite',
      index: 3,
    });
  });

  it('finds the zone around a child element', () => {
    const parent = zone({ 'data-drop': 'favourites' });
    const child = document.createElement('span');
    parent.append(child);
    expect(readHit(child)).toEqual({ zone: 'favourites' });
  });

  it('is null outside any zone', () => {
    expect(readHit(null)).toBeNull();
    expect(readHit(document.createElement('div'))).toBeNull();
    expect(readHit(zone({ 'data-drop': 'unknown' }))).toBeNull();
  });
});

describe('DragController', () => {
  let hovered: Element | null;
  let actions: { [K in keyof DragActions]: Mock<DragActions[K]> };
  let controller: DragController;

  const press = (x = 0, y = 0, button = 0) =>
    controller.press(pointer('pointerdown', x, y, button) as PointerEvent, source);
  const moveTo = (x: number, y: number) => window.dispatchEvent(pointer('pointermove', x, y));
  const release = () => window.dispatchEvent(pointer('pointerup'));

  beforeEach(() => {
    vi.useFakeTimers();
    hovered = null;
    document.elementFromPoint = () => hovered;
    actions = { isFavourite: vi.fn(() => false), drop: vi.fn(), expand: vi.fn(), dragOut: vi.fn() };
    controller = new DragController(actions);
  });

  afterEach(() => {
    window.dispatchEvent(pointer('pointerup'));
    vi.runAllTimers();
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it('does not start a drag below the threshold, and a plain click drops nothing', () => {
    press();
    moveTo(3, 0);
    expect(controller.current).toBeNull();
    release();
    expect(actions.drop).not.toHaveBeenCalled();
  });

  it('ignores presses with a button other than the main one', () => {
    press(0, 0, 2);
    moveTo(40, 0);
    expect(controller.current).toBeNull();
  });

  it('shows the drag and marks the body once past the threshold', () => {
    press();
    moveTo(10, 0);
    expect(controller.current?.point).toEqual({ x: 10, y: 0 });
    expect(document.body.classList.contains('dragging')).toBe(true);
    release();
    expect(controller.current).toBeNull();
    expect(document.body.classList.contains('dragging')).toBe(false);
  });

  it('drops on the folder under the pointer', () => {
    hovered = zone({ 'data-drop': 'row', 'data-path': '/w/d', 'data-kind': 'folder' });
    press();
    moveTo(10, 0);
    release();
    expect(actions.drop).toHaveBeenCalledWith(source, { action: 'move', folder: '/w/d' });
  });

  it('drops nothing where a drop does nothing', () => {
    hovered = zone({ 'data-drop': 'row', 'data-path': '/w/b.md', 'data-kind': 'file' });
    press();
    moveTo(10, 0);
    expect(controller.current?.target).toBeNull();
    release();
    expect(actions.drop).not.toHaveBeenCalled();
  });

  it('swallows the click that follows a drag, but only that one', () => {
    const clicks = vi.fn();
    window.addEventListener('click', clicks);
    press();
    moveTo(10, 0);
    release();
    document.body.dispatchEvent(pointer('click'));
    expect(clicks).not.toHaveBeenCalled();
    vi.runAllTimers();
    document.body.dispatchEvent(pointer('click'));
    expect(clicks).toHaveBeenCalledTimes(1);
    window.removeEventListener('click', clicks);
  });

  it('cancels with Escape: nothing is dropped and the ghost goes away', () => {
    hovered = zone({ 'data-drop': 'root', 'data-path': '/w/x' });
    press();
    moveTo(10, 0);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(controller.current).toBeNull();
    expect(document.body.classList.contains('dragging')).toBe(false);
    moveTo(20, 0);
    expect(controller.current).toBeNull();
    release();
    expect(actions.drop).not.toHaveBeenCalled();
  });

  it('expands a folder after hovering it for 700 ms, not before', () => {
    hovered = zone({ 'data-drop': 'row', 'data-path': '/w/d', 'data-kind': 'folder' });
    press();
    moveTo(10, 0);
    vi.advanceTimersByTime(699);
    expect(actions.expand).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(actions.expand).toHaveBeenCalledExactlyOnceWith('/w/d');
  });

  it('restarts the wait when the pointer moves to another folder, and stops when it leaves', () => {
    hovered = zone({ 'data-drop': 'row', 'data-path': '/w/d', 'data-kind': 'folder' });
    press();
    moveTo(10, 0);
    vi.advanceTimersByTime(500);
    hovered = zone({ 'data-drop': 'row', 'data-path': '/w/e', 'data-kind': 'folder' });
    moveTo(12, 0);
    vi.advanceTimersByTime(500);
    expect(actions.expand).not.toHaveBeenCalled();
    hovered = null;
    moveTo(14, 0);
    vi.advanceTimersByTime(1000);
    expect(actions.expand).not.toHaveBeenCalled();
  });

  it('hands the drag to the system when the pointer leaves the window', () => {
    press();
    moveTo(10, 0);
    document.documentElement.dispatchEvent(new MouseEvent('pointerleave'));
    expect(actions.dragOut).toHaveBeenCalledExactlyOnceWith(['/w/a.md']);
    expect(controller.current).toBeNull();
    expect(document.body.classList.contains('dragging')).toBe(false);
  });

  it('does not drag out before the drag has started or after Escape', () => {
    press();
    document.documentElement.dispatchEvent(new MouseEvent('pointerleave'));
    moveTo(10, 0);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.documentElement.dispatchEvent(new MouseEvent('pointerleave'));
    expect(actions.dragOut).not.toHaveBeenCalled();
  });
});
