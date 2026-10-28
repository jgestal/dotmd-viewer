// Pure path helpers that treat `\` and `/` alike, so POSIX, Windows (`C:\`) and UNC (`\\server\share`) paths work on any platform.

const SEPARATORS = /[\\/]+/;
const TRIMMED_SEPARATORS = /^[\\/]+|[\\/]+$/g;

/** Forward slashes, repeated separators collapsed (a UNC `//` prefix is kept), no trailing slash except on a root. */
export function normalisePath(path: string): string {
  const isUnc = /^[\\/]{2}[^\\/]/.test(path);
  const joined = path.split(SEPARATORS).join('/');
  const slashed = isUnc ? `/${joined}` : joined;
  return slashed.length > rootLength(slashed) && slashed.endsWith('/')
    ? slashed.slice(0, -1)
    : slashed;
}

/** Length of the root prefix of a normalised path: `/`, `C:/`, `//server/share`, or 0 when relative. */
function rootLength(normalised: string): number {
  const unc = /^\/\/[^/]+\/[^/]+/.exec(normalised);
  if (unc) return unc[0].length;
  if (/^[A-Za-z]:\//.test(normalised)) return 3;
  return normalised.startsWith('/') ? 1 : 0;
}

/** Key used to compare paths: normalised, and lower-cased on case-insensitive file systems. */
export function comparablePath(path: string, caseInsensitive = false): string {
  const normalised = normalisePath(path);
  return caseInsensitive ? normalised.toLowerCase() : normalised;
}

export function isSamePath(a: string, b: string, caseInsensitive = false): boolean {
  return comparablePath(a, caseInsensitive) === comparablePath(b, caseInsensitive);
}

/** True when `child` is `parent` itself or lies below it; matches whole segments, so `/a/b` does not contain `/a/bc`. */
export function isSameOrInside(parent: string, child: string, caseInsensitive = false): boolean {
  const base = comparablePath(parent, caseInsensitive);
  const target = comparablePath(child, caseInsensitive);
  return target === base || target.startsWith(base.endsWith('/') ? base : `${base}/`);
}

/** Last segment of the path; empty for a root. */
export function baseName(path: string): string {
  const normalised = normalisePath(path);
  return normalised.length <= rootLength(normalised)
    ? ''
    : normalised.slice(normalised.lastIndexOf('/') + 1);
}

/** Parent of the path; a root is its own parent and a bare name has parent `.`. */
export function dirName(path: string): string {
  const normalised = normalisePath(path);
  const root = rootLength(normalised);
  if (normalised.length <= root) return normalised;
  const slash = normalised.lastIndexOf('/');
  return slash < 0 ? '.' : normalised.slice(0, Math.max(slash, root));
}

/** Appends segments to `base` using the separator style of `base`; empty segments are ignored. */
export function joinPath(base: string, ...segments: string[]): string {
  const separator = base.includes('\\') && !base.includes('/') ? '\\' : '/';
  const parts = segments.map((s) => s.replace(TRIMMED_SEPARATORS, '')).filter((s) => s !== '');
  return [base.replace(/[\\/]+$/, ''), ...parts].join(separator);
}

/**
 * `relative` resolved against the directory `base`, with `.` and `..` collapsed (a `..` never
 * climbs above the root). An absolute `relative` wins. The result is normalised.
 */
export function resolvePath(base: string, relative: string): string {
  const target = normalisePath(relative);
  if (rootLength(target) > 0) return target;
  const root = normalisePath(base);
  const prefixLength = rootLength(root);
  const segments = root
    .slice(prefixLength)
    .split('/')
    .filter((segment) => segment !== '');
  for (const part of target.split('/')) {
    if (part === '..') segments.pop();
    else if (part !== '' && part !== '.') segments.push(part);
  }
  const prefix = root.slice(0, prefixLength);
  const separator = prefix === '' || prefix.endsWith('/') ? '' : '/';
  return prefix + (segments.length > 0 ? separator : '') + segments.join('/');
}
