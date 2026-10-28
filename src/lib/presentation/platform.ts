// Which desktop the app runs on, for shortcuts and menu conventions.
import type { Platform } from './commands/shortcuts';

export const detectPlatform = (userAgent: string): Platform => {
  if (/mac/i.test(userAgent)) return 'mac';
  if (/win/i.test(userAgent)) return 'windows';
  return 'linux';
};

export const currentPlatform = (): Platform =>
  detectPlatform(typeof navigator === 'undefined' ? '' : navigator.userAgent);
