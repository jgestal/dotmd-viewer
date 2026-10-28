// The slide each document was last on, for the length of the session.

const positions = new Map<string, number>();

export const rememberSlide = (path: string | null, index: number): void => {
  if (path !== null) positions.set(path, index);
};

export const recalledSlide = (path: string | null): number | null =>
  (path === null ? undefined : positions.get(path)) ?? null;
