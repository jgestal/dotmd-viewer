import { describe, expect, it } from 'vitest';
import { detectPlatform } from './platform';

describe('detectPlatform', () => {
  it.each([
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15', 'mac'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/120.0', 'windows'],
    ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15', 'linux'],
    ['', 'linux'],
  ])('%s → %s', (userAgent, platform) => {
    expect(detectPlatform(userAgent)).toBe(platform);
  });
});
