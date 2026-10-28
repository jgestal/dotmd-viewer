// The only door to the Rust side and to the Tauri plugins: every failure leaves as an AppError.
import { invoke } from '@tauri-apps/api/core';
import { toAppError } from '../../domain/errors';

/** Runs a Tauri API call and turns whatever it rejects with into an AppError. */
export const attempt = async <T>(action: () => Promise<T>): Promise<T> => {
  try {
    return await action();
  } catch (thrown) {
    throw toAppError(thrown);
  }
};

/** Invokes a Rust command; arguments are camelCase, Tauri maps them to the snake_case params. */
export const call = <T>(command: string, args?: Record<string, unknown>): Promise<T> =>
  attempt(() => invoke<T>(command, args));
