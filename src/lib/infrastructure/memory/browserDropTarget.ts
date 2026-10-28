import { isMarkdownPath } from '../../domain/paths';
import type { DropEvent, DropTarget } from '../../ports';
import type { MemoryFileSystem } from './memoryFileSystem';

/** A browser gives no real paths, so dropped files live in the demo file system under this folder. */
export const DROPPED_FOLDER = '/dropped';

type DropListener = (event: DropEvent) => void;

const droppedPath = (file: File): string => `${DROPPED_FOLDER}/${file.name}`;

/**
 * Drag and drop in a plain browser (HTML5 events on the window). A dropped file's text is copied
 * into the in-memory file system as `/dropped/<name>` so the app can open it like a real file.
 * Only Markdown and text files are read; other types still reach the listener (to be rejected).
 * Browsers hide file names until the drop, so `enter` and `over` usually carry no paths, and a
 * dropped folder cannot be opened here.
 */
export class BrowserDropTarget implements DropTarget {
  constructor(
    private readonly fs: MemoryFileSystem,
    private readonly target: Window = window,
  ) {}

  onDrag(listener: DropListener): () => void {
    let depth = 0;
    const enter = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      depth += 1;
      listener({ type: depth === 1 ? 'enter' : 'over', paths: pathsOf(event) });
    };
    const over = (event: DragEvent) => {
      if (depth === 0) return;
      event.preventDefault();
      listener({ type: 'over', paths: pathsOf(event) });
    };
    const leave = () => {
      if (depth === 0) return;
      depth -= 1;
      if (depth === 0) listener({ type: 'leave', paths: [] });
    };
    const drop = (event: DragEvent) => {
      if (depth === 0) return;
      event.preventDefault();
      depth = 0;
      void this.seedAndEmit(event, listener);
    };

    this.target.addEventListener('dragenter', enter);
    this.target.addEventListener('dragover', over);
    this.target.addEventListener('dragleave', leave);
    this.target.addEventListener('drop', drop);
    return () => {
      this.target.removeEventListener('dragenter', enter);
      this.target.removeEventListener('dragover', over);
      this.target.removeEventListener('dragleave', leave);
      this.target.removeEventListener('drop', drop);
    };
  }

  private async seedAndEmit(event: DragEvent, listener: DropListener): Promise<void> {
    const files = [...(event.dataTransfer?.files ?? [])];
    const documents = files.filter((file) => isMarkdownPath(file.name));
    const texts = await Promise.all(documents.map((file) => file.text()));
    documents.forEach((file, index) => this.fs.seedFile(droppedPath(file), texts[index]));
    listener({ type: 'drop', paths: files.map(droppedPath) });
  }
}

const pathsOf = (event: DragEvent): string[] =>
  [...(event.dataTransfer?.files ?? [])].map(droppedPath);
