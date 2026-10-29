import { describe, expect, it } from 'vitest';
import { sanitize } from './sanitize';

describe('sanitize', () => {
  it('removes script elements and their content', () => {
    expect(sanitize('<p>a</p><script>alert(1)</script>')).toBe('<p>a</p>');
  });

  it('removes event handler attributes but keeps the element', () => {
    const html = sanitize('<img src="x.png" onerror="alert(1)">');
    expect(html).toContain('<img');
    expect(html).not.toContain('onerror');
  });

  it('removes style elements and style attributes', () => {
    expect(sanitize('<style>p{color:red}</style><p style="color:red">a</p>')).toBe('<p>a</p>');
  });

  it('removes javascript: link targets', () => {
    const html = sanitize('<a href="javascript:alert(1)">x</a>');
    expect(html).toBe('<a>x</a>');
  });

  it('removes javascript: image sources', () => {
    expect(sanitize('<img src="javascript:alert(1)" alt="x">')).toBe('<img alt="x">');
  });

  it('keeps ordinary links', () => {
    expect(sanitize('<a href="https://example.com/a">x</a>')).toBe(
      '<a href="https://example.com/a">x</a>',
    );
  });

  it('keeps the attributes the preview relies on', () => {
    const html = sanitize(
      '<h1 data-sourcepos="1:1-1:7" id="t" class="c"><span data-math-style="inline">x</span></h1>',
    );
    expect(html).toContain('data-sourcepos="1:1-1:7"');
    expect(html).toContain('data-math-style="inline"');
    expect(html).toContain('id="t"');
    expect(html).toContain('class="c"');
  });

  it('keeps disabled task list checkboxes', () => {
    const html = sanitize('<li><input type="checkbox" disabled checked> done</li>');
    expect(html).toContain('<input type="checkbox" disabled="" checked="">');
  });

  it('keeps inline SVG such as diagrams', () => {
    const html = sanitize('<svg viewBox="0 0 10 10"><rect width="5" height="5"></rect></svg>');
    expect(html).toContain('<svg');
    expect(html).toContain('<rect');
  });

  it('removes scripts hidden in SVG', () => {
    expect(sanitize('<svg><script>alert(1)</script><circle r="1"></circle></svg>')).not.toContain(
      'script',
    );
  });
});
