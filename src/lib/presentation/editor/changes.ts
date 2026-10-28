// Turns "the document now reads X" into the smallest edit that gets the editor there, so an
// external change (a file reloaded from disk) keeps the caret and the undo history.

export interface TextChange {
  readonly from: number;
  readonly to: number;
  readonly insert: string;
}

/** The single replacement turning `current` into `next`; `null` when they are equal. */
export function changeBetween(current: string, next: string): TextChange | null {
  if (current === next) return null;
  const shortest = Math.min(current.length, next.length);
  let start = 0;
  while (start < shortest && current[start] === next[start]) start++;
  let end = 0;
  while (
    end < shortest - start &&
    current[current.length - 1 - end] === next[next.length - 1 - end]
  ) {
    end++;
  }
  return { from: start, to: current.length - end, insert: next.slice(start, next.length - end) };
}
