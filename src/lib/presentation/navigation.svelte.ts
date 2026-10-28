// Navigation channel between the outline and the visible view (preview now, code editor later).
// The outline asks to reveal a source line; the view scrolls there and reports the line at its top.

export interface RevealRequest {
  /** Increments on every request, so asking for the same line twice still triggers views. */
  readonly id: number;
  /** Zero-based source line, front matter included. */
  readonly line: number;
}

class Navigation {
  /** Latest reveal request; views react to it with an `$effect`. */
  reveal = $state<RevealRequest | null>(null);
  /** Zero-based source line at the top of the visible view. */
  topLine = $state(0);

  revealLine(line: number): void {
    this.reveal = { id: (this.reveal?.id ?? 0) + 1, line };
  }

  /** Called by views while scrolling (they throttle it). */
  reportTopLine(line: number): void {
    this.topLine = line;
  }
}

export const navigation = new Navigation();
