import { describe, expect, it } from 'vitest';
import { appError, isAppError, toAppError } from './errors';

describe('appError', () => {
  it('omits the path when not given', () => {
    expect(appError('notFound', 'missing')).toEqual({ kind: 'notFound', message: 'missing' });
    expect('path' in appError('notFound', 'missing')).toBe(false);
  });

  it('keeps the path when given', () => {
    expect(appError('io', 'boom', '/a.md')).toEqual({ kind: 'io', message: 'boom', path: '/a.md' });
  });
});

describe('isAppError', () => {
  it('accepts the shape the Rust commands send', () => {
    expect(isAppError({ kind: 'permissionDenied', message: 'no' })).toBe(true);
    expect(isAppError({ kind: 'alreadyExists', message: 'x', path: '/p' })).toBe(true);
  });

  it.each([
    null,
    undefined,
    'notFound',
    42,
    {},
    { kind: 'notFound' },
    { message: 'x' },
    { kind: 'teapot', message: 'x' },
    { kind: 'io', message: 3 },
    { kind: 'io', message: 'x', path: 7 },
  ])('rejects %j', (value) => {
    expect(isAppError(value)).toBe(false);
  });
});

describe('toAppError', () => {
  it('passes an AppError through unchanged', () => {
    const error = appError('unsupported', 'binary', '/x.bin');
    expect(toAppError(error)).toBe(error);
  });

  it('wraps an Error as an io error', () => {
    expect(toAppError(new Error('disk full'))).toEqual({ kind: 'io', message: 'disk full' });
  });

  it('wraps anything else by its string form', () => {
    expect(toAppError('plugin failed')).toEqual({ kind: 'io', message: 'plugin failed' });
    expect(toAppError(404)).toEqual({ kind: 'io', message: '404' });
  });
});
