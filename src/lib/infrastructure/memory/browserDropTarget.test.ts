import { describe, expect, it } from 'vitest';
import type { DropEvent } from '../../ports';
import { BrowserDropTarget } from './browserDropTarget';
import { MemoryFileSystem } from './memoryFileSystem';

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

/** jsdom has no DragEvent: a plain event carrying the `dataTransfer` the adapter reads. */
const drag = (type: string, files: File[] = [], types: string[] = ['Files']): Event => {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files, types } });
  return event;
};

const setup = () => {
  const fs = new MemoryFileSystem();
  const events: DropEvent[] = [];
  const stop = new BrowserDropTarget(fs, window).onDrag((event) => events.push(event));
  return { fs, events, stop };
};

describe('BrowserDropTarget', () => {
  it('reports one enter and one leave however many elements the pointer crosses', () => {
    const { events, stop } = setup();
    window.dispatchEvent(drag('dragenter'));
    window.dispatchEvent(drag('dragenter'));
    window.dispatchEvent(drag('dragover'));
    window.dispatchEvent(drag('dragleave'));
    window.dispatchEvent(drag('dragleave'));
    window.dispatchEvent(drag('dragleave'));
    expect(events.map((event) => event.type)).toEqual(['enter', 'over', 'over', 'leave']);
    stop();
  });

  it('names dragged files under /dropped when the browser reveals them', () => {
    const { events, stop } = setup();
    window.dispatchEvent(drag('dragenter', [new File([''], 'a.md')]));
    expect(events).toEqual([{ type: 'enter', paths: ['/dropped/a.md'] }]);
    stop();
  });

  it('copies dropped Markdown text into the file system and skips other types', async () => {
    const { fs, events, stop } = setup();
    window.dispatchEvent(drag('dragenter'));
    window.dispatchEvent(drag('drop', [new File(['# Hi'], 'a.md'), new File(['x'], 'pic.png')]));
    await settle();
    expect(events.at(-1)).toEqual({ type: 'drop', paths: ['/dropped/a.md', '/dropped/pic.png'] });
    expect((await fs.readText('/dropped/a.md')).content).toBe('# Hi');
    expect(await fs.kind('/dropped/pic.png')).toBe('missing');
    stop();
  });

  it('prevents the default only for drags of files and ignores drops without a drag', () => {
    const { events, stop } = setup();
    const text = drag('dragenter', [], ['text/plain']);
    window.dispatchEvent(text);
    const stray = drag('drop');
    window.dispatchEvent(stray);
    window.dispatchEvent(drag('dragover'));
    expect(text.defaultPrevented).toBe(false);
    expect(stray.defaultPrevented).toBe(false);
    expect(events).toEqual([]);
    stop();
  });

  it('stops listening after unsubscribing', () => {
    const { events, stop } = setup();
    stop();
    window.dispatchEvent(drag('dragenter'));
    expect(events).toEqual([]);
  });
});
