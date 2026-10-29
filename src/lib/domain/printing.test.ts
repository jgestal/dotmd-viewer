import { describe, expect, it } from 'vitest';
import { FLOW_MARGIN_MM, pageRule, pageSetupFor, pdfFileName } from './printing';

describe('pageSetupFor', () => {
  it('prints the pages layout edge to edge on the chosen paper', () => {
    expect(pageSetupFor('pages', 'letter')).toEqual({ size: 'letter', marginMm: 0 });
  });

  it.each(['continuous', 'slides'] as const)('gives the %s layout page margins', (layout) => {
    expect(pageSetupFor(layout, 'a4')).toEqual({ size: 'a4', marginMm: FLOW_MARGIN_MM });
  });
});

describe('pageRule', () => {
  it('asks for A4 with no margin', () => {
    expect(pageRule({ size: 'a4', marginMm: 0 })).toBe('@page { size: A4; margin: 0mm; }');
  });

  it('asks for letter with the given margin', () => {
    expect(pageRule({ size: 'letter', marginMm: 20 })).toBe(
      '@page { size: letter; margin: 20mm; }',
    );
  });
});

describe('pdfFileName', () => {
  it.each([
    ['notes.md', 'notes.pdf'],
    ['Guide.MARKDOWN', 'Guide.pdf'],
    ['todo.txt', 'todo.pdf'],
    ['v1.2.notes.md', 'v1.2.notes.pdf'],
    ['Untitled', 'Untitled.pdf'],
    ['données été.md', 'données été.pdf'],
    ['report.docx', 'report.docx.pdf'],
    ['', '.pdf'],
  ])('names the export of %j %j', (name, expected) => {
    expect(pdfFileName(name)).toBe(expected);
  });
});
