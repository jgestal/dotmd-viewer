import { resolvePath } from '$lib/domain/paths';

export type LinkTarget =
  | { readonly kind: 'anchor'; readonly id: string }
  | { readonly kind: 'document'; readonly path: string }
  | { readonly kind: 'external'; readonly url: string };

const EXTERNAL = /^(?:https?:|mailto:)/i;
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const MARKDOWN_FILE = /\.(?:md|markdown|mdown|mkd)$/i;
const WINDOWS_DRIVE = /^[a-z]:[\\/]/i;

const decode = (text: string): string => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

/**
 * What a link in the rendered document points to, or `null` when it must do nothing: other
 * schemes, files that are not Markdown, and relative links in a document that has no folder yet.
 */
export function classifyLink(href: string, documentDir: string | null): LinkTarget | null {
  if (href.startsWith('#'))
    return href.length > 1 ? { kind: 'anchor', id: decode(href.slice(1)) } : null;
  if (EXTERNAL.test(href)) return { kind: 'external', url: href };
  if (ANY_SCHEME.test(href) && !WINDOWS_DRIVE.test(href)) return null;

  const file = decode(href.replace(/[?#].*$/, ''));
  if (
    !MARKDOWN_FILE.test(file) ||
    (documentDir === null && !WINDOWS_DRIVE.test(file) && !file.startsWith('/'))
  )
    return null;
  return { kind: 'document', path: resolvePath(documentDir ?? '', file) };
}
