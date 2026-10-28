export interface FrontMatterEntry {
  readonly key: string;
  readonly value: string;
}

const SIMPLE_ENTRY = /^([^\s#:][^:]*?):\s+(.+?)\s*$/;
const QUOTED = /^(["'])(.*)\1$/;

/** The top-level `key: value` lines of a YAML block; nested keys, lists and comments are skipped. */
export function parseFrontMatter(yaml: string): FrontMatterEntry[] {
  return yaml.split(/\r\n|\r|\n/).flatMap((line) => {
    const match = SIMPLE_ENTRY.exec(line);
    if (!match) return [];
    return [{ key: match[1], value: match[2].replace(QUOTED, '$2') }];
  });
}
