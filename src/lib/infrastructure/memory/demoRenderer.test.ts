import { describe, expect, it } from 'vitest';
import { DemoRenderer } from './demoRenderer';

const render = async (markdown: string): Promise<string> =>
  (await new DemoRenderer().render(markdown)).html;

describe('DemoRenderer', () => {
  it('splits front matter off the HTML', async () => {
    const result = await new DemoRenderer().render('---\ntitle: Hi\n---\n\n# Body\n');
    expect(result.frontMatter).toBe('title: Hi');
    expect(result.html).not.toContain('title: Hi');
    expect(result.html).toContain('Body');
  });

  it('reports no front matter when there is none', async () => {
    expect((await new DemoRenderer().render('# Body')).frontMatter).toBeNull();
  });

  it('marks inline and display maths like comrak', async () => {
    const html = await render('Inline $a^2$ here\n\n$$\nb\n$$\n\nand $$c$$ inline.');
    expect(html).toContain('<span data-math-style="inline">a^2</span>');
    expect(html).toContain('<span data-sourcepos="3:1-5:1" data-math-style="display">b</span>');
    expect(html).toContain('<span data-math-style="display">c</span>');
  });

  it('does not treat prices as maths', async () => {
    const html = await render('It costs $5 and $10 today.');
    expect(html).not.toContain('data-math-style');
  });

  it('puts source positions on blocks, counting the front matter lines', async () => {
    const html = await render('---\na: 1\n---\n# Title\n\npara\n');
    expect(html).toContain('<h1 data-sourcepos="4:1-4:1">');
    expect(html).toContain('<p data-sourcepos="6:1-6:1">');
  });

  it('keeps the language class on fences and escapes the code', async () => {
    const html = await render('```ts\nconst a = 1 < 2;\n```\n\n```\nplain\n```');
    expect(html).toContain('<code class="language-ts">const a = 1 &lt; 2;\n</code>');
    expect(html).toContain('<code>plain\n</code>');
  });

  it('gives headings anchors with the domain slugs, numbering repeats', async () => {
    const html = await render('# Año 2024\n\n# Same\n\n# Same\n');
    expect(html).toContain('<a href="#año-2024" aria-hidden="true" class="anchor" id="año-2024">');
    expect(html).toContain('id="same"');
    expect(html).toContain('id="same-1"');
  });

  it('renders GitHub alerts as comrak does', async () => {
    const html = await render('> [!NOTE]\n> Callouts work.\n>\n> More.\n');
    expect(html).toContain(
      '<div class="markdown-alert markdown-alert-note" data-sourcepos="1:1-4:1">',
    );
    expect(html).toContain('<p class="markdown-alert-title">Note</p>');
    expect(html).toContain('Callouts work.</p>');
    expect(html).toContain('<p data-sourcepos="4:1-4:1">More.</p>');
    expect(html).not.toContain('[!NOTE]');
    expect(html).not.toContain('blockquote');
  });

  it('renders an alert whose body starts on the marker line', async () => {
    const html = await render('> [!WARNING]\n> careful\n');
    expect(html).toContain('markdown-alert-warning');
    expect(html).toContain('careful');
  });

  it('keeps ordinary blockquotes', async () => {
    expect(await render('> [!OTHER]\n> x\n')).toContain('<blockquote');
  });

  it('renders task list checkboxes', async () => {
    const html = await render('- [x] done\n- [ ] todo\n- plain\n');
    expect(html).toContain('<input type="checkbox" disabled checked /> done');
    expect(html).toContain('<input type="checkbox" disabled /> todo');
    expect(html).toContain('>plain</li>');
  });

  it('uses the align attribute in tables', async () => {
    const html = await render('| a | b |\n| :-- | :-: |\n| 1 | 2 |\n');
    expect(html).toContain('<th align="left"');
    expect(html).toContain('<th align="center"');
    expect(html).not.toContain('style=');
  });

  it('supports highlights, strikethrough and footnotes', async () => {
    const html = await render('==hi== ~~no~~ note[^1]\n\n[^1]: Like this.\n');
    expect(html).toContain('<mark>hi</mark>');
    expect(html).toContain('<s>no</s>');
    expect(html).toContain('footnote-ref');
    expect(html).toContain('Like this.');
  });

  it('passes raw HTML through for the sanitiser to deal with', async () => {
    expect(await render('<div class="x">hi</div>')).toContain('<div class="x">hi</div>');
  });
});
