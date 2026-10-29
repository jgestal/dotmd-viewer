// The DOM side of dragging in the sidebar: pointer listeners, what is under the pointer, the
// hover-to-expand timer and the hand-over to the system when the pointer leaves the window.
// The rules themselves are in dragMove.ts. HTML5 drag and drop is avoided on purpose: inside the
// Tauri webview it competes with the native file-drop handler.
import {
  dropOf,
  EXPAND_DELAY_MS,
  hoveredFolder,
  pointerMoved,
  press,
  type Drag,
  type DragSource,
  type DropTarget,
  type Hit,
} from './dragMove';

export interface DragActions {
  isFavourite(path: string): boolean;
  /** Carries out a drop; `source` is what was dragged. */
  drop(source: DragSource, target: DropTarget): void;
  expand(folder: string): void;
  /** The pointer left the window: let the system carry `paths` from here. */
  dragOut(paths: readonly string[]): void;
}

/** Elements that accept a drop say so with `data-drop` (see `dropAttributes`). */
export const DROP_SELECTOR = '[data-drop]';

/** The hit an element stands for, or `null` when it is not inside a drop zone. */
export function readHit(element: Element | null): Hit | null {
  const zone = element?.closest<HTMLElement>(DROP_SELECTOR);
  if (!zone) return null;
  const { drop, path = '', kind, index = '0' } = zone.dataset;
  if (drop === 'row')
    return { zone: 'row', path, entryKind: kind === 'folder' ? 'folder' : 'file' };
  if (drop === 'root') return { zone: 'root', path };
  if (drop === 'favourite') return { zone: 'favourite', index: Number(index) };
  return drop === 'favourites' ? { zone: 'favourites' } : null;
}

export class DragController {
  /** The drag under way, or `null` while idle or before the pointer has moved far enough. */
  current = $state<Drag | null>(null);
  readonly #actions: DragActions;
  #drag: Drag | null = null;
  #cancelled = false;
  #expandTimer: ReturnType<typeof setTimeout> | undefined;
  #expandFolder: string | null = null;

  constructor(actions: DragActions) {
    this.#actions = actions;
  }

  /** Starts tracking the pointer from a press on a draggable row. */
  press(event: PointerEvent, source: DragSource): void {
    if (event.button !== 0 || this.#drag !== null) return;
    this.#drag = press(source, { x: event.clientX, y: event.clientY });
    this.#cancelled = false;
    window.addEventListener('pointermove', this.#onMove);
    window.addEventListener('pointerup', this.#onUp);
    window.addEventListener('keydown', this.#onKey, true);
    document.documentElement.addEventListener('pointerleave', this.#onLeave);
  }

  readonly #onMove = (event: PointerEvent): void => {
    if (this.#drag === null || this.#cancelled) return;
    const hit = readHit(document.elementFromPoint(event.clientX, event.clientY));
    const point = { x: event.clientX, y: event.clientY };
    this.#drag = pointerMoved(this.#drag, point, hit, this.#actions);
    if (!this.#drag.active) return;
    document.body.classList.add('dragging');
    this.current = this.#drag;
    this.#watchHover(hoveredFolder(this.#drag));
  };

  readonly #onUp = (): void => {
    const drag = this.#drag;
    const target = drag === null || this.#cancelled ? null : dropOf(drag);
    if (drag?.active) this.#swallowNextClick();
    this.#finish();
    if (drag !== null && target !== null) this.#actions.drop(drag.source, target);
  };

  readonly #onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || this.#drag === null) return;
    event.stopPropagation();
    this.#cancelled = true;
    this.current = null;
    this.#watchHover(null);
    document.body.classList.remove('dragging');
  };

  readonly #onLeave = (): void => {
    const drag = this.#drag;
    if (drag === null || !drag.active || this.#cancelled) return;
    this.#finish();
    this.#actions.dragOut([drag.source.path]);
  };

  /** Expands the hovered folder after a pause; moving to another row restarts the wait. */
  #watchHover(folder: string | null): void {
    if (folder === this.#expandFolder) return;
    clearTimeout(this.#expandTimer);
    this.#expandFolder = folder;
    if (folder === null) return;
    this.#expandTimer = setTimeout(() => this.#actions.expand(folder), EXPAND_DELAY_MS);
  }

  /** The click that follows a drop would otherwise open the row that was dragged. */
  #swallowNextClick(): void {
    const swallow = (event: Event): void => event.stopPropagation();
    window.addEventListener('click', swallow, true);
    setTimeout(() => window.removeEventListener('click', swallow, true), 0);
  }

  #finish(): void {
    window.removeEventListener('pointermove', this.#onMove);
    window.removeEventListener('pointerup', this.#onUp);
    window.removeEventListener('keydown', this.#onKey, true);
    document.documentElement.removeEventListener('pointerleave', this.#onLeave);
    document.body.classList.remove('dragging');
    this.#watchHover(null);
    this.#drag = null;
    this.current = null;
  }
}
