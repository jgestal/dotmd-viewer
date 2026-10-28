// Pure helpers behind the slides view: which slide a key leads to and how the stage is scaled.

export type SlideAction = 'next' | 'previous' | 'first' | 'last' | 'exit';

export const STAGE_WIDTH = 1280;
export const STAGE_HEIGHT = 720;

/** Keeps a slide index inside the deck; 0 for an empty deck. */
export const clampIndex = (index: number, count: number): number =>
  Math.max(0, Math.min(index, count - 1));

const KEY_ACTIONS: Readonly<Record<string, SlideAction>> = {
  ArrowRight: 'next',
  ArrowDown: 'next',
  PageDown: 'next',
  ArrowLeft: 'previous',
  ArrowUp: 'previous',
  PageUp: 'previous',
  Home: 'first',
  End: 'last',
  Escape: 'exit',
};

/** The action for a key press, or null when the key means nothing to the slides. */
export function actionForKey(key: string, shift: boolean): SlideAction | null {
  if (key === ' ') return shift ? 'previous' : 'next';
  return KEY_ACTIONS[key] ?? null;
}

/** The slide an action leads to; `exit` stays where it is. */
export function indexAfter(action: SlideAction, index: number, count: number): number {
  switch (action) {
    case 'next':
      return clampIndex(index + 1, count);
    case 'previous':
      return clampIndex(index - 1, count);
    case 'first':
      return 0;
    case 'last':
      return clampIndex(count - 1, count);
    case 'exit':
      return clampIndex(index, count);
  }
}

/** Largest scale at which the 16:9 stage fits the available box; 0 when there is no room. */
export const fitScale = (availableWidth: number, availableHeight: number): number =>
  Math.max(0, Math.min(availableWidth / STAGE_WIDTH, availableHeight / STAGE_HEIGHT));
