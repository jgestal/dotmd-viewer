import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bindLinks, enhance } from './enhance';

const mermaid = vi.hoisted(() => ({
  loaded: vi.fn(),
  initialize: vi.fn(),
  render: vi.fn(async (_id: string, source: string) => ({
    svg: `<svg><title>${source}</title></svg>`,
  })),
}));

vi.mock('mermaid', () => {
  mermaid.loaded();
  return { default: { initialize: mermaid.initialize, render: mermaid.render } };
});

const options = { scheme: 'light', diagramErrorLabel: 'Diagram error' } as const;

const page = (html: string): HTMLElement => {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container;
};

beforeEach(() => {
  mermaid.render.mockClear();
  mermaid.initialize.mockClear();
});

describe('enhance maths', () => {
  it('renders inline and display maths with KaTeX', async () => {
    const container = page(
      '<p><span data-math-style="inline">x^2</span></p><span data-math-style="display">y</span>',
    );
    await enhance(container, options);
    const [inline, display] = container.querySelectorAll('[data-math-style]');
    expect(inline.classList.contains('math-rendered')).toBe(true);
    expect(inline.querySelector('.katex')).not.toBeNull();
    expect(inline.querySelector('.katex-display')).toBeNull();
    expect(display.querySelector('.katex-display')).not.toBeNull();
  });

  it('shows invalid maths instead of throwing', async () => {
    const container = page('<span data-math-style="inline">\\frac{</span>');
    await expect(enhance(container, options)).resolves.toBeUndefined();
    expect(container.querySelector('.katex-error')).not.toBeNull();
  });
});

describe('enhance code', () => {
  it('highlights fenced code in a known language', async () => {
    const container = page('<pre><code class="language-ts">const a: number = 1;</code></pre>');
    await enhance(container, options);
    const code = container.querySelector('code')!;
    expect(code.classList.contains('hljs')).toBe(true);
    expect(code.querySelector('.hljs-keyword')?.textContent).toBe('const');
    expect(code.textContent).toBe('const a: number = 1;');
  });

  it('resolves language aliases', async () => {
    const container = page('<pre><code class="language-sh"># hi\necho 1</code></pre>');
    await enhance(container, options);
    expect(container.querySelector('.hljs-comment')?.textContent).toBe('# hi');
  });

  it('leaves unknown languages and unlabelled code alone', async () => {
    const container = page(
      '<pre><code class="language-klingon">a &lt; b</code></pre><pre><code>x</code></pre>',
    );
    const before = container.innerHTML;
    await enhance(container, options);
    expect(container.innerHTML).toBe(before);
  });

  it('does not load Mermaid when there is no diagram', async () => {
    mermaid.loaded.mockClear();
    await enhance(page('<pre><code class="language-js">1</code></pre>'), options);
    expect(mermaid.loaded).not.toHaveBeenCalled();
  });
});

describe('enhance diagrams', () => {
  it('replaces a mermaid block with the drawn SVG and keeps its position', async () => {
    const container = page(
      '<pre data-sourcepos="3:1-6:1"><code class="language-mermaid">graph LR\nA--&gt;B</code></pre>',
    );
    await enhance(container, options);
    const holder = container.querySelector('.mermaid-diagram')!;
    expect(container.querySelector('pre')).toBeNull();
    expect(holder.getAttribute('data-sourcepos')).toBe('3:1-6:1');
    expect(holder.querySelector('svg title')?.textContent).toBe('graph LR\nA-->B');
    expect(mermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'default', securityLevel: 'strict' }),
    );
  });

  it('draws with the dark theme and reconfigures when the scheme changes', async () => {
    await enhance(page('<pre><code class="language-mermaid">graph TD\nDark</code></pre>'), {
      ...options,
      scheme: 'dark',
    });
    expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }));
  });

  it('shows the error when a diagram is invalid', async () => {
    mermaid.render.mockRejectedValueOnce(new Error('Parse error'));
    const container = page('<pre><code class="language-mermaid">nonsense</code></pre>');
    await enhance(container, options);
    const holder = container.querySelector('.mermaid-error')!;
    expect(holder.textContent).toContain('Diagram error');
    expect(holder.querySelector('pre')?.textContent).toBe('Parse error');
  });
});

describe('bindLinks', () => {
  const setup = (html: string, documentDir: string | null = '/docs') => {
    const root = page(html);
    document.body.append(root);
    const onOpenLink = vi.fn();
    const unbind = bindLinks(root, { documentDir, onOpenLink });
    return { root, onOpenLink, unbind };
  };

  const click = (element: Element): MouseEvent => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event;
  };

  it('scrolls to an anchor inside the preview without opening anything', () => {
    const { root, onOpenLink } = setup('<a href="#end">go</a><h2 id="end">End</h2>');
    const scroll = vi.fn();
    root.querySelector('h2')!.scrollIntoView = scroll;
    const event = click(root.querySelector('a')!);
    expect(event.defaultPrevented).toBe(true);
    expect(scroll).toHaveBeenCalledWith({ block: 'start' });
    expect(onOpenLink).not.toHaveBeenCalled();
  });

  it('opens relative Markdown links in the app', () => {
    const { root, onOpenLink } = setup('<a href="notes/Ideas.md"><em>idea</em></a>');
    const event = click(root.querySelector('em')!);
    expect(event.defaultPrevented).toBe(true);
    expect(onOpenLink).toHaveBeenCalledWith({ kind: 'document', path: '/docs/notes/Ideas.md' });
  });

  it('opens web links externally', () => {
    const { root, onOpenLink } = setup('<a href="https://example.com">web</a>');
    click(root.querySelector('a')!);
    expect(onOpenLink).toHaveBeenCalledWith({ kind: 'external', url: 'https://example.com' });
  });

  it('swallows links that lead nowhere without navigating', () => {
    const { root, onOpenLink } = setup('<a href="photo.png">img</a>');
    expect(click(root.querySelector('a')!).defaultPrevented).toBe(true);
    expect(onOpenLink).not.toHaveBeenCalled();
  });

  it('ignores clicks outside links and stops listening after unbind', () => {
    const { root, onOpenLink, unbind } = setup('<p>text</p><a href="https://x.org">x</a>');
    expect(click(root.querySelector('p')!).defaultPrevented).toBe(false);
    unbind();
    click(root.querySelector('a')!);
    expect(onOpenLink).not.toHaveBeenCalled();
  });
});
