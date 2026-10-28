// Short, non-blocking messages: the presentation's implementation of the Notifier port.
import type { Notifier } from '$lib/ports';

export interface Toast {
  readonly id: number;
  readonly kind: 'info' | 'error';
  readonly message: string;
}

const DISMISS_AFTER_MS = { info: 3500, error: 7000 } as const;

let toasts = $state<Toast[]>([]);
let nextId = 1;

const dismiss = (id: number): void => {
  toasts = toasts.filter((toast) => toast.id !== id);
};

const show = (kind: Toast['kind'], message: string): void => {
  const id = nextId++;
  toasts = [...toasts, { id, kind, message }];
  setTimeout(() => dismiss(id), DISMISS_AFTER_MS[kind]);
};

export const toastStore = {
  get items(): readonly Toast[] {
    return toasts;
  },
  dismiss,
};

export const notifier: Notifier = {
  info: (message) => show('info', message),
  error: (message) => show('error', message),
};
