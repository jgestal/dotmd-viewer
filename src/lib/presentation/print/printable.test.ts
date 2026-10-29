import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryAssetUrls, MemoryRenderer } from '$lib/infrastructure/memory';
import { sheetGeometry } from '../pages/sheet';
import { buildSheets, mountPrintable, nextFrame, unmountPrintable } from './printable';

const options = {
  paged: false,
  pageSize: 'a4',
  setup: { size: 'a4', marginMm: 20 },
  diagramErrorLabel: 'diagram error',
  images: { documentDir: '/d', assetUrls: new MemoryAssetUrls() },
} as const;

const printable = () => document.getElementById('print-root');

beforeEach(() => {
  Object.defineProperty(document, 'fonts', {
    value: { ready: Promise.resolve() },
    configurable: true,
  });
});

afterEach(() => unmountPrintable());

describe('mountPrintable', () => {
  it('attaches the rendered document to the body with the page rule for its setup', async () => {
    await mountPrintable(new MemoryRenderer(), 'Hello', options);
    expect(printable()?.parentElement).toBe(document.body);
    expect(printable()?.querySelector('style')?.textContent).toBe(
      '@page { size: A4; margin: 20mm; }',
    );
    expect(printable()?.querySelector('article.print-flow')?.textContent).toBe('Hello');
  });

  it('replaces the previous printable instead of stacking them', async () => {
    await mountPrintable(new MemoryRenderer(), 'First', options);
    await mountPrintable(new MemoryRenderer(), 'Second', options);
    expect(document.querySelectorAll('#print-root')).toHaveLength(1);
    expect(printable()?.textContent).toContain('Second');
    expect(printable()?.textContent).not.toContain('First');
  });

  it('lays the paged layout out on numbered sheets with edge to edge pages', async () => {
    await mountPrintable(new MemoryRenderer(), 'Hello', {
      ...options,
      paged: true,
      setup: { size: 'letter', marginMm: 0 },
    });
    expect(printable()?.querySelector('style')?.textContent).toBe(
      '@page { size: letter; margin: 0mm; }',
    );
    const sheets = printable()?.querySelectorAll('.print-sheet');
    expect(sheets).toHaveLength(1);
    expect(sheets?.[0].querySelector('.print-page-number')?.textContent).toBe('1 / 1');
    expect(document.body.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });
});

describe('unmountPrintable', () => {
  it('removes the printable and tolerates there being none', async () => {
    await mountPrintable(new MemoryRenderer(), 'Hello', options);
    unmountPrintable();
    unmountPrintable();
    expect(printable()).toBeNull();
  });
});

describe('buildSheets', () => {
  const blocks = ['a', 'b', 'c'].map((text) => {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    return paragraph;
  });

  it('puts each range on its own sheet, numbered, with the sheet geometry as variables', () => {
    const geometry = sheetGeometry('a4');
    const sheets = buildSheets(
      blocks,
      [
        { start: 0, end: 2 },
        { start: 2, end: 3 },
      ],
      geometry,
    );
    expect(sheets.map((sheet) => sheet.querySelector('.print-sheet-body')?.textContent)).toEqual([
      'ab',
      'c',
    ]);
    expect(sheets.map((sheet) => sheet.querySelector('footer')?.textContent)).toEqual([
      '1 / 2',
      '2 / 2',
    ]);
    expect(sheets[0].style.getPropertyValue('--sheet-w')).toBe('794px');
    expect(sheets[0].style.getPropertyValue('--sheet-h')).toBe('1123px');
    expect(sheets[0].style.getPropertyValue('--sheet-margin')).toBe('76px');
  });
});

describe('nextFrame', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('resolves on the next frame', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => callback(0));
    await expect(nextFrame()).resolves.toBeUndefined();
  });

  it('still resolves after 100 ms when no frame is ever drawn', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', () => 0);
    let settled = false;
    void nextFrame().then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(99);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
  });
});
