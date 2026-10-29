import { describe, expect, it } from 'vitest';
import { actionsToRun, pathsToOpen, pdfDestination, type OpenRequest } from './openRequests';

const requests: readonly OpenRequest[] = [
  { action: 'open', path: '/a.md' },
  { action: 'exportPdf', path: '/b.md' },
  { action: 'open', path: '/notes' },
  { action: 'print', path: '/c.md' },
  { action: 'new' },
];

describe('pathsToOpen', () => {
  it('keeps the plain opens in order', () => {
    expect(pathsToOpen(requests)).toEqual(['/a.md', '/notes']);
  });

  it('is empty when nothing is asked for', () => {
    expect(pathsToOpen([])).toEqual([]);
  });
});

describe('actionsToRun', () => {
  it('keeps every other request in order', () => {
    expect(actionsToRun(requests)).toEqual([
      { action: 'exportPdf', path: '/b.md' },
      { action: 'print', path: '/c.md' },
      { action: 'new' },
    ]);
  });

  it('is empty when only files are opened', () => {
    expect(actionsToRun([{ action: 'open', path: '/a.md' }])).toEqual([]);
  });
});

describe('pdfDestination', () => {
  it.each([
    ['/home/ana/notes.md', '/home/ana/notes.pdf'],
    ['C:\\Users\\ana\\Guía.MARKDOWN', 'C:\\Users\\ana\\Guía.pdf'],
    ['/w/v1.2.notes.md', '/w/v1.2.notes.pdf'],
    ['/w/README', '/w/README.pdf'],
  ])('writes %s next to it as %s', (path, expected) => {
    expect(pdfDestination({ path })).toBe(expected);
  });

  it('uses the destination asked for', () => {
    expect(pdfDestination({ path: '/a.md', out: '/out/report.pdf' })).toBe('/out/report.pdf');
  });
});
