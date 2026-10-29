import { describe, expect, it } from 'vitest';
import { standaloneHtml, withoutFontFaces } from './standaloneHtml';

const page = {
  title: 'Notes',
  lang: 'en',
  theme: 'sepia',
  css: 'body{color:red}',
  body: '<h1>Hi</h1>',
} as const;

describe('standaloneHtml', () => {
  it('assembles a complete document with the styles and the body inline', () => {
    expect(standaloneHtml(page)).toBe(
      [
        '<!doctype html>',
        '<html lang="en" data-theme="sepia">',
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<meta name="generator" content="SimpleDotMD">',
        '<title>Notes</title>',
        '<style>body{color:red}</style>',
        '</head>',
        '<body>',
        '<main class="markdown-body"><h1>Hi</h1></main>',
        '</body>',
        '</html>',
        '',
      ].join('\n'),
    );
  });

  it('escapes the title and the language', () => {
    const html = standaloneHtml({ ...page, title: 'A & B <script>"x"', lang: 'e"n' });
    expect(html).toContain('<title>A &amp; B &lt;script&gt;&quot;x&quot;</title>');
    expect(html).toContain('<html lang="e&quot;n"');
  });

  it('keeps the body as given, markup included', () => {
    expect(standaloneHtml({ ...page, body: '<p class="a">é & ü</p>' })).toContain(
      '<main class="markdown-body"><p class="a">é & ü</p></main>',
    );
  });

  it('starts with the doctype so browsers do not use quirks mode', () => {
    expect(standaloneHtml(page).startsWith('<!doctype html>\n')).toBe(true);
  });

  it('freezes the theme it is given', () => {
    expect(standaloneHtml({ ...page, theme: 'night' })).toContain('data-theme="night"');
  });
});

describe('withoutFontFaces', () => {
  it('removes every @font-face rule and keeps the others', () => {
    const css =
      '.a{x:1}@font-face{font-family:KaTeX_Main;src:url(fonts/a.woff2) format("woff2")}.b{y:2}' +
      '@font-face{\n  font-family:KaTeX_Math;\n  src:url(fonts/b.woff2)\n}.c{z:3}';
    expect(withoutFontFaces(css)).toBe('.a{x:1}.b{y:2}.c{z:3}');
  });

  it('leaves css without font faces unchanged', () => {
    expect(withoutFontFaces('.a{x:1}')).toBe('.a{x:1}');
  });
});
