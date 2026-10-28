import { describe, expect, it } from 'vitest';
import { renameSelectionEnd } from './renameSelection';

describe('renameSelectionEnd', () => {
  it('stops before the extension of a file', () => {
    expect(renameSelectionEnd('Slides.md', 'file')).toBe(6);
  });

  it('stops before the last extension only', () => {
    expect(renameSelectionEnd('notes.v2.md', 'file')).toBe(8);
  });

  it('selects everything when a file has no extension or only a leading dot', () => {
    expect(renameSelectionEnd('README', 'file')).toBe(6);
    expect(renameSelectionEnd('.hidden', 'file')).toBe(7);
  });

  it('selects the whole name of a folder, dots included', () => {
    expect(renameSelectionEnd('v1.2', 'folder')).toBe(4);
  });

  it('counts Unicode names in UTF-16 units like the input selection does', () => {
    expect(renameSelectionEnd('análisis.md', 'file')).toBe(8);
  });
});
