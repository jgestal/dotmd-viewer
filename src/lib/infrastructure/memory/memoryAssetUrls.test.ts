import { describe, expect, it } from 'vitest';
import { MemoryAssetUrls } from './memoryAssetUrls';

describe('MemoryAssetUrls', () => {
  it('returns the seeded URL, whatever the spelling of the path', () => {
    const urls = new MemoryAssetUrls();
    urls.seed('/d/a.png', 'data:image/png;base64,AAAA');
    expect(urls.toUrl('\\d\\\\a.png')).toBe('data:image/png;base64,AAAA');
  });

  it('cannot show a path it was not given', () => {
    expect(new MemoryAssetUrls().toUrl('/d/a.png')).toBeNull();
  });
});
