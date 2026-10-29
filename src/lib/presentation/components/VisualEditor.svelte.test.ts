import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDocument } from '$lib/domain/document';
import { app } from '../app.svelte';
import { navigation } from '../navigation.svelte';
import VisualEditor from './VisualEditor.svelte';

const WELCOME =
  '---\ntitle: Welcome\n---\n\n# Welcome\n\nA *simple* viewer.\n\n## Lists\n\n* one\n';

const open = (path: string | null, raw: string) => ({
  doc: openDocument({ path, raw, encoding: 'utf-8', hasBom: false }),
});

const editable = () => document.querySelector<HTMLElement>('.ProseMirror');

describe('VisualEditor', () => {
  let component: ReturnType<typeof mount> | null;

  beforeAll(() => {
    globalThis.IntersectionObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver;
    // ProseMirror measures the selection, which jsdom cannot lay out.
    Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList;
    Range.prototype.getBoundingClientRect ??= () => new DOMRect();
  });

  // The first test waits for Milkdown to be transformed and loaded.
  beforeEach(async () => {
    app.documentState = open('/notes/a.md', WELCOME);
    app.edit = vi.fn(async () => {});
    component = mount(VisualEditor, { target: document.body });
    flushSync();
    await vi.waitFor(() => expect(editable()).not.toBeNull(), { timeout: 30_000 });
  }, 30_000);

  afterEach(() => {
    if (component) unmount(component);
    component = null;
    document.body.innerHTML = '';
  });

  it('loads the editor on demand and shows the document without its front matter', () => {
    expect(editable()!.querySelector('h1')!.textContent).toBe('Welcome');
    expect(editable()!.textContent).not.toContain('title:');
    expect(editable()!.getAttribute('aria-label')).toBe('Editable preview');
    expect(document.querySelector('[role="status"]')).toBeNull();
  });

  it('does not touch the document when nothing is edited', () => {
    expect(app.edit).not.toHaveBeenCalled();
  });

  it('writes a document changed from outside into the editor without echoing it back', async () => {
    app.documentState = open('/notes/a.md', WELCOME.replace('simple', 'tiny'));
    flushSync();
    await vi.waitFor(() => expect(editable()!.textContent).toContain('A tiny viewer.'));
    expect(app.edit).not.toHaveBeenCalled();
  });

  it('starts a fresh editor when another document opens', async () => {
    app.documentState = open('/notes/b.md', '# Other\n');
    flushSync();
    await vi.waitFor(() => expect(editable()?.textContent).toBe('Other'));
    expect(document.querySelectorAll('.ProseMirror')).toHaveLength(1);
  });

  it('honours a reveal request without failing when layout is not measurable', () => {
    navigation.revealLine(9);
    flushSync();
    expect(navigation.reveal?.line).toBe(9);
  });
});
