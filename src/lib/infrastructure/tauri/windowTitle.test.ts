import { describe, expect, it } from 'vitest';
import { APP_NAME, formatWindowTitle } from './windowTitle';

describe('formatWindowTitle', () => {
  it('shows the bare name on macOS, edited or not', () => {
    expect(formatWindowTitle('notes.md', true, true, true)).toBe('notes.md');
    expect(formatWindowTitle('notes.md', false, true, true)).toBe('notes.md');
  });

  it('shows "*name - App" on Windows and Linux', () => {
    expect(formatWindowTitle('notes.md', true, false, true)).toBe(`*notes.md - ${APP_NAME}`);
    expect(formatWindowTitle('notes.md', false, false, true)).toBe(`notes.md - ${APP_NAME}`);
  });

  it('shows only the app name without a document', () => {
    expect(formatWindowTitle('whatever', true, false, false)).toBe(APP_NAME);
    expect(formatWindowTitle(APP_NAME, false, false, true)).toBe(APP_NAME);
  });
});
