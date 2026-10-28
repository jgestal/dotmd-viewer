// The error every port reports, shaped like the Rust `AppError` the commands return, so a
// failure reads the same whether it came from disk, a dialog or a test double.

export type ErrorKind =
  'notFound' | 'permissionDenied' | 'alreadyExists' | 'invalidInput' | 'unsupported' | 'io';

export interface AppError {
  readonly kind: ErrorKind;
  readonly message: string;
  readonly path?: string;
}

const ERROR_KINDS: readonly string[] = [
  'notFound',
  'permissionDenied',
  'alreadyExists',
  'invalidInput',
  'unsupported',
  'io',
];

export const appError = (kind: ErrorKind, message: string, path?: string): AppError =>
  path === undefined ? { kind, message } : { kind, message, path };

export const isAppError = (value: unknown): value is AppError => {
  if (typeof value !== 'object' || value === null) return false;
  const { kind, message, path } = value as Record<string, unknown>;
  return (
    typeof kind === 'string' &&
    ERROR_KINDS.includes(kind) &&
    typeof message === 'string' &&
    (path === undefined || typeof path === 'string')
  );
};

/** Turns anything thrown (an AppError, an Error, a string from a plugin) into an AppError. */
export const toAppError = (thrown: unknown): AppError => {
  if (isAppError(thrown)) return thrown;
  if (thrown instanceof Error) return appError('io', thrown.message);
  return appError('io', String(thrown));
};
