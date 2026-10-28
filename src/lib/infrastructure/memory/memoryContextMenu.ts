import type { ContextMenu, MenuItem } from '../../ports';

/** Answers each menu with the next scripted choice (`null` when none is left) and records the items shown. */
export class MemoryContextMenu implements ContextMenu {
  /** The items of every menu shown, in order. */
  readonly shown: (readonly MenuItem[])[] = [];
  readonly #answers: (string | null)[] = [];

  answer(id: string | null): void {
    this.#answers.push(id);
  }

  async show(items: readonly MenuItem[]): Promise<string | null> {
    this.shown.push(items);
    return this.#answers.shift() ?? null;
  }
}
