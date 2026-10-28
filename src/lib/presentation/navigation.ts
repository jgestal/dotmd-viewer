// Pure helpers of the navigation channel: line <-> scroll offset maths and a trailing throttle.

/** Zero-based line shown at `scrollTop` when every line is `lineHeight` pixels tall. */
export const lineAtOffset = (scrollTop: number, lineHeight: number): number =>
  Math.max(0, Math.floor(scrollTop / lineHeight));

/** Scroll offset that puts the zero-based `line` at the top. */
export const offsetOfLine = (line: number, lineHeight: number): number =>
  Math.max(0, line) * lineHeight;

/** Runs `fn` at most once per `intervalMs`: first call at once, the latest arguments after the pause. */
export const throttle = <Args extends unknown[]>(
  fn: (...args: Args) => void,
  intervalMs: number,
): ((...args: Args) => void) => {
  let waiting = false;
  let pending: Args | null = null;
  const release = (): void => {
    if (pending === null) {
      waiting = false;
      return;
    }
    const args = pending;
    pending = null;
    fn(...args);
    setTimeout(release, intervalMs);
  };
  return (...args) => {
    if (waiting) {
      pending = args;
      return;
    }
    waiting = true;
    fn(...args);
    setTimeout(release, intervalMs);
  };
};
