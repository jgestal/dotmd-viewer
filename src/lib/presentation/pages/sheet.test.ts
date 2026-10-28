import { describe, expect, it } from 'vitest';
import { fitScale, sheetGeometry } from './sheet';

describe('sheetGeometry', () => {
  it('lays out A4 at 96 dpi with 20 mm margins', () => {
    expect(sheetGeometry('a4')).toEqual({
      width: 794,
      height: 1123,
      margin: 76,
      contentWidth: 642,
      contentHeight: 971,
    });
  });

  it('lays out US Letter at 96 dpi with 20 mm margins', () => {
    expect(sheetGeometry('letter')).toEqual({
      width: 816,
      height: 1056,
      margin: 76,
      contentWidth: 664,
      contentHeight: 904,
    });
  });
});

describe('fitScale', () => {
  it('shrinks the sheet to a narrower viewport', () => {
    expect(fitScale(400, 800)).toBe(0.5);
  });

  it('never enlarges the sheet', () => {
    expect(fitScale(1600, 800)).toBe(1);
  });

  it('leaves the sheet alone when the viewport has no width yet', () => {
    expect(fitScale(0, 800)).toBe(1);
  });
});
