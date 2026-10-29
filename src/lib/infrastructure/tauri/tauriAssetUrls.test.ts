import { clearMocks, mockConvertFileSrc } from '@tauri-apps/api/mocks';
import { afterEach, describe, expect, it } from 'vitest';
import { tauriAssetUrls } from './tauriAssetUrls';

afterEach(() => clearMocks());

describe('tauriAssetUrls', () => {
  it('points the webview at the asset protocol with the path percent-encoded', () => {
    mockConvertFileSrc('macos');
    expect(tauriAssetUrls.toUrl('/Users/ada/my docs/a.png')).toBe(
      'asset://localhost/%2FUsers%2Fada%2Fmy%20docs%2Fa.png',
    );
  });

  it('uses the http form on Windows', () => {
    mockConvertFileSrc('windows');
    expect(tauriAssetUrls.toUrl('C:\\pics\\a.png')).toBe(
      'http://asset.localhost/C%3A%5Cpics%5Ca.png',
    );
  });
});
