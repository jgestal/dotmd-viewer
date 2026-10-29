// How the split view divides its space between the code and the preview.

export const MIN_PANE_PX = 240;
export const DEFAULT_RATIO = 0.5;
export const KEYBOARD_STEP_PX = 16;

/** Share of the space given to the first pane, keeping both panes at least `MIN_PANE_PX` wide. */
export function clampRatio(ratio: number, total: number): number {
  if (total < 2 * MIN_PANE_PX) return DEFAULT_RATIO;
  const min = MIN_PANE_PX / total;
  return Math.min(1 - min, Math.max(min, ratio));
}
