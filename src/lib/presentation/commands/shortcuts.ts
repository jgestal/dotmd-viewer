// Platform-neutral accelerators such as 'Mod+Shift+S', where Mod is Cmd on macOS and Ctrl elsewhere.

export type Platform = 'mac' | 'windows' | 'linux';

/** One accelerator for every platform, or one per platform family. */
export type AcceleratorSpec = string | { readonly mac?: string; readonly other?: string };

export interface Accelerator {
  readonly mod: boolean;
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
  /** Upper-cased letter, digit, punctuation character or function key such as 'F11'. */
  readonly key: string;
}

export interface KeyEventLike {
  readonly key: string;
  readonly code: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}

const PUNCTUATION_CODES: Readonly<Record<string, string>> = {
  '=': 'Equal',
  '-': 'Minus',
  ',': 'Comma',
  '.': 'Period',
  '/': 'Slash',
  ';': 'Semicolon',
  "'": 'Quote',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '\\': 'Backslash',
  '`': 'Backquote',
};

const MODIFIER_NAMES = ['Mod', 'Ctrl', 'Alt', 'Shift'];
const MAC_SYMBOLS = { ctrl: '⌃', mod: '⌘', alt: '⌥', shift: '⇧' } as const;
const TAURI_NAMES = { ctrl: 'Ctrl', mod: 'CmdOrCtrl', alt: 'Alt', shift: 'Shift' } as const;

const FUNCTION_KEY = /^F([1-9]|1\d|2[0-4])$/;
const LETTER = /^[A-Z]$/;
const DIGIT = /^\d$/;

const isValidKey = (key: string): boolean =>
  LETTER.test(key) || DIGIT.test(key) || key in PUNCTUATION_CODES || FUNCTION_KEY.test(key);

/** Parses 'Mod+Shift+S'; returns null when the text is not a valid accelerator. */
export function parseAccelerator(text: string): Accelerator | null {
  const parts = text.split('+');
  const key = (parts.pop() ?? '').toUpperCase();
  if (!isValidKey(key) || parts.some((name) => !MODIFIER_NAMES.includes(name))) return null;
  return {
    mod: parts.includes('Mod'),
    ctrl: parts.includes('Ctrl'),
    alt: parts.includes('Alt'),
    shift: parts.includes('Shift'),
    key,
  };
}

function keyMatches({ key }: Accelerator, event: KeyEventLike): boolean {
  if (LETTER.test(key)) {
    // Alt changes the produced character on macOS (Alt+F gives 'ƒ'), so fall back to the physical key.
    return event.key.toUpperCase() === key || (event.altKey && event.code === `Key${key}`);
  }
  if (DIGIT.test(key)) return event.code === `Digit${key}` || event.code === `Numpad${key}`;
  if (FUNCTION_KEY.test(key)) return event.code === key;
  return event.code === PUNCTUATION_CODES[key];
}

/** Whether the keyboard event triggers the accelerator on the platform (modifiers must match exactly). */
export function matchesEvent(accel: string, event: KeyEventLike, platform: Platform): boolean {
  const accelerator = parseAccelerator(accel);
  if (!accelerator) return false;
  const mac = platform === 'mac';
  const wantsCtrl = mac ? accelerator.ctrl : accelerator.mod || accelerator.ctrl;
  return (
    event.metaKey === (mac && accelerator.mod) &&
    event.ctrlKey === wantsCtrl &&
    event.altKey === accelerator.alt &&
    event.shiftKey === accelerator.shift &&
    keyMatches(accelerator, event)
  );
}

/** Human-readable accelerator: '⌘⇧S' on macOS, 'Ctrl+Shift+S' elsewhere. */
export function formatAccelerator(accel: string, platform: Platform): string {
  const accelerator = parseAccelerator(accel);
  if (!accelerator) return accel;
  if (platform === 'mac') {
    const symbols = (['ctrl', 'mod', 'alt', 'shift'] as const)
      .filter((name) => accelerator[name])
      .map((name) => MAC_SYMBOLS[name]);
    return [...symbols, accelerator.key].join('');
  }
  const names = [
    accelerator.ctrl || accelerator.mod ? 'Ctrl' : '',
    accelerator.alt ? 'Alt' : '',
    accelerator.shift ? 'Shift' : '',
    accelerator.key,
  ];
  return names.filter(Boolean).join('+');
}

/** Accelerator syntax of Tauri native menus: 'CmdOrCtrl+Shift+S'. */
export function toTauriAccelerator(accel: string): string {
  const accelerator = parseAccelerator(accel);
  if (!accelerator) return accel;
  const modifiers = (['ctrl', 'mod', 'alt', 'shift'] as const)
    .filter((name) => accelerator[name])
    .map((name) => TAURI_NAMES[name]);
  return [...modifiers, accelerator.key].join('+');
}

/** The accelerator text a spec resolves to on the platform, if any. */
export function resolveAccelerator(spec: AcceleratorSpec, platform: Platform): string | undefined {
  if (typeof spec === 'string') return spec;
  return platform === 'mac' ? spec.mac : spec.other;
}
