// Line-level structure of a Markdown document shared by the domain rules (statistics, outline,
// slides): where the YAML front matter ends and which lines belong to fenced code blocks.

export interface FrontMatterSplit {
  /** The YAML between the `---` fences, or `null` when the document has none. */
  readonly frontMatter: string | null;
  /** The document without its front matter. */
  readonly body: string;
  /** Zero-based index of the first body line in the original document. */
  readonly bodyStartLine: number;
}

const FRONT_MATTER_FENCE = /^---\s*$/;
const FRONT_MATTER_CLOSE = /^(?:---|\.\.\.)\s*$/;
const YAML_KEY = /^[^\s#:-][^:]*:(?:\s|$)/;
const YAML_TOP_LEVEL = /^(?:[^\s#:-][^:]*:(?:\s|$)|#|- |-$)/;
const CODE_FENCE = /^ {0,3}(`{3,}|~{3,})/;

export const splitLines = (text: string): string[] => text.split(/\r\n|\r|\n/);

/**
 * Whether the lines between the fences read as a YAML mapping: every top-level line is a key,
 * a comment or a list item, and there is at least one key. This keeps a document that opens with
 * a `---` slide separator (`---`, `# Slide`, `---`) from being mistaken for front matter.
 */
const looksLikeYaml = (lines: readonly string[]): boolean => {
  const topLevel = lines.filter((line) => line.trim() !== '' && !/^\s/.test(line));
  return (
    topLevel.every((line) => YAML_TOP_LEVEL.test(line)) &&
    (lines.length === 0 || topLevel.some((line) => YAML_KEY.test(line)))
  );
};

/** Separates a leading YAML front matter block (`---` … `---` or `...`) from the body. */
export const splitFrontMatter = (text: string): FrontMatterSplit => {
  const lines = splitLines(text.startsWith('\uFEFF') ? text.slice(1) : text);
  const noFrontMatter = { frontMatter: null, body: text, bodyStartLine: 0 };
  if (!FRONT_MATTER_FENCE.test(lines[0] ?? '')) return noFrontMatter;

  const close = lines.findIndex((line, index) => index > 0 && FRONT_MATTER_CLOSE.test(line));
  if (close === -1 || !looksLikeYaml(lines.slice(1, close))) return noFrontMatter;

  return {
    frontMatter: lines.slice(1, close).join('\n'),
    body: lines.slice(close + 1).join('\n'),
    bodyStartLine: close + 1,
  };
};

/**
 * Marks the lines that belong to fenced code blocks, fences included. A fence closes only with
 * the same character, at least as long as the opening one; an unclosed fence runs to the end.
 */
export const codeLineMask = (lines: readonly string[]): boolean[] => {
  let open: string | null = null;
  return lines.map((line) => {
    const fence = CODE_FENCE.exec(line)?.[1];
    if (open === null) {
      if (fence) open = fence;
      return open !== null;
    }
    if (fence && fence[0] === open[0] && fence.length >= open.length && line.trim() === fence) {
      open = null;
    }
    return true;
  });
};
