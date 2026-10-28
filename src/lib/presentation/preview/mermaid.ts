// Mermaid is large, so it is imported the first time a document actually has a diagram.
import type { ColorScheme } from './colorScheme';

type MermaidApi = (typeof import('mermaid'))['default'];

let api: Promise<MermaidApi> | null = null;
let configuredFor: ColorScheme | null = null;
let counter = 0;
const cache = new Map<string, string>();
const CACHE_LIMIT = 100;

const load = (): Promise<MermaidApi> =>
  (api ??= import('mermaid').then((module) => module.default));

export type DiagramResult =
  { readonly ok: true; readonly svg: string } | { readonly ok: false; readonly message: string };

/** Draws a diagram; failures come back as a value. Results are cached per theme and source. */
export async function drawDiagram(source: string, scheme: ColorScheme): Promise<DiagramResult> {
  const key = `${scheme}\u0000${source}`;
  const cached = cache.get(key);
  if (cached) return { ok: true, svg: cached };
  try {
    const mermaid = await load();
    if (configuredFor !== scheme) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: scheme === 'dark' ? 'dark' : 'default',
      });
      configuredFor = scheme;
    }
    const { svg } = await mermaid.render(`mermaid-diagram-${++counter}`, source);
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(key, svg);
    return { ok: true, svg };
  } catch (thrown) {
    return { ok: false, message: thrown instanceof Error ? thrown.message : String(thrown) };
  }
}
