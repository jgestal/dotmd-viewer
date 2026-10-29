import { describe, expect, it } from 'vitest';
import {
  baseName,
  comparablePath,
  dirName,
  isMarkdownPath,
  isSamePath,
  isSameOrInside,
  joinPath,
  normalisePath,
  resolvePath,
  retargetPath,
  withoutMarkdownExtension,
} from './paths';

describe('withoutMarkdownExtension', () => {
  it('drops a Markdown or text extension whatever its case', () => {
    expect(withoutMarkdownExtension('a.md')).toBe('a');
    expect(withoutMarkdownExtension('b.TXT')).toBe('b');
    expect(withoutMarkdownExtension('c.v2.markdown')).toBe('c.v2');
  });

  it('keeps any other name as it is', () => {
    expect(withoutMarkdownExtension('d.png')).toBe('d.png');
    expect(withoutMarkdownExtension('md')).toBe('md');
  });
});

describe('normalisePath', () => {
  it('leaves a clean POSIX path untouched', () => {
    expect(normalisePath('/a/b/c.md')).toBe('/a/b/c.md');
  });

  it('removes trailing slashes', () => {
    expect(normalisePath('/a/b/')).toBe('/a/b');
    expect(normalisePath('/a/b///')).toBe('/a/b');
  });

  it('converts backslashes to slashes', () => {
    expect(normalisePath('a\\b\\c')).toBe('a/b/c');
  });

  it('collapses repeated separators', () => {
    expect(normalisePath('/a//b\\\\c')).toBe('/a/b/c');
  });

  it('keeps the POSIX root', () => {
    expect(normalisePath('/')).toBe('/');
    expect(normalisePath('///')).toBe('/');
  });

  it('keeps the Windows drive root with its slash', () => {
    expect(normalisePath('C:\\')).toBe('C:/');
    expect(normalisePath('C:\\Users\\me\\')).toBe('C:/Users/me');
  });

  it('keeps the UNC prefix', () => {
    expect(normalisePath('\\\\server\\share\\docs\\')).toBe('//server/share/docs');
    expect(normalisePath('//server/share')).toBe('//server/share');
    expect(normalisePath('\\\\server\\share\\')).toBe('//server/share');
  });

  it('handles empty and relative input', () => {
    expect(normalisePath('')).toBe('');
    expect(normalisePath('docs/')).toBe('docs');
  });

  it('preserves case and Unicode', () => {
    expect(normalisePath('/Ñandú/Ünï/')).toBe('/Ñandú/Ünï');
  });
});

describe('comparablePath', () => {
  it('keeps case by default', () => {
    expect(comparablePath('/A/B/')).toBe('/A/B');
  });

  it('lower-cases when case-insensitive', () => {
    expect(comparablePath('C:\\Users\\ME\\', true)).toBe('c:/users/me');
  });
});

describe('isSamePath', () => {
  it('ignores separator style and trailing slash', () => {
    expect(isSamePath('C:\\a\\b', 'C:/a/b/')).toBe(true);
  });

  it('is case-sensitive by default', () => {
    expect(isSamePath('/a/B', '/a/b')).toBe(false);
  });

  it('is case-insensitive on request', () => {
    expect(isSamePath('/a/B', '/a/b', true)).toBe(true);
  });

  it('distinguishes different paths', () => {
    expect(isSamePath('/a/b', '/a/c')).toBe(false);
  });
});

describe('isSameOrInside', () => {
  it('accepts the same path', () => {
    expect(isSameOrInside('/a/b', '/a/b')).toBe(true);
    expect(isSameOrInside('/a/b/', '/a/b')).toBe(true);
  });

  it('accepts descendants', () => {
    expect(isSameOrInside('/a/b', '/a/b/c/d.md')).toBe(true);
  });

  it('rejects siblings that share a string prefix', () => {
    expect(isSameOrInside('/a/b', '/a/bc')).toBe(false);
    expect(isSameOrInside('/a/b', '/a/bc/d')).toBe(false);
  });

  it('rejects ancestors', () => {
    expect(isSameOrInside('/a/b', '/a')).toBe(false);
  });

  it('treats the POSIX root as containing everything absolute', () => {
    expect(isSameOrInside('/', '/a/b')).toBe(true);
    expect(isSameOrInside('/', '/')).toBe(true);
  });

  it('works across mixed separators on Windows paths', () => {
    expect(isSameOrInside('C:\\Users\\me', 'C:/Users/me/docs/a.md')).toBe(true);
    expect(isSameOrInside('C:\\', 'C:\\Users')).toBe(true);
    expect(isSameOrInside('C:\\Users', 'D:\\Users\\a')).toBe(false);
  });

  it('works for UNC paths', () => {
    expect(isSameOrInside('\\\\server\\share', '\\\\server\\share\\docs\\a.md')).toBe(true);
    expect(isSameOrInside('\\\\server\\share', '\\\\server\\share2\\a.md')).toBe(false);
    expect(isSameOrInside('\\\\server\\share', '\\\\other\\share\\a.md')).toBe(false);
  });

  it('honours the case-insensitive flag', () => {
    expect(isSameOrInside('/A/B', '/a/b/c')).toBe(false);
    expect(isSameOrInside('/A/B', '/a/b/c', true)).toBe(true);
  });
});

describe('baseName', () => {
  it('returns the last segment', () => {
    expect(baseName('/a/b/c.md')).toBe('c.md');
    expect(baseName('/a/b/')).toBe('b');
  });

  it('handles Windows and UNC paths', () => {
    expect(baseName('C:\\Users\\me\\notes.md')).toBe('notes.md');
    expect(baseName('\\\\server\\share\\docs\\a.md')).toBe('a.md');
  });

  it('returns a bare name unchanged', () => {
    expect(baseName('notes.md')).toBe('notes.md');
  });

  it('returns an empty string for roots and empty input', () => {
    expect(baseName('/')).toBe('');
    expect(baseName('C:\\')).toBe('');
    expect(baseName('\\\\server\\share')).toBe('');
    expect(baseName('')).toBe('');
  });

  it('keeps Unicode names', () => {
    expect(baseName('/docs/résumé ✓.md')).toBe('résumé ✓.md');
  });
});

describe('dirName', () => {
  it('returns the parent folder', () => {
    expect(dirName('/a/b/c.md')).toBe('/a/b');
    expect(dirName('/a/b/')).toBe('/a');
  });

  it('returns the root for top-level entries', () => {
    expect(dirName('/a')).toBe('/');
    expect(dirName('C:\\a')).toBe('C:/');
    expect(dirName('\\\\server\\share\\a.md')).toBe('//server/share');
  });

  it('returns a root as its own parent', () => {
    expect(dirName('/')).toBe('/');
    expect(dirName('C:\\')).toBe('C:/');
    expect(dirName('\\\\server\\share')).toBe('//server/share');
  });

  it('handles Windows paths', () => {
    expect(dirName('C:\\Users\\me\\a.md')).toBe('C:/Users/me');
  });

  it('returns "." for a bare name and relative parents', () => {
    expect(dirName('a.md')).toBe('.');
    expect(dirName('docs/a.md')).toBe('docs');
  });

  it('returns an empty path unchanged', () => {
    expect(dirName('')).toBe('');
  });
});

describe('joinPath', () => {
  it('joins POSIX segments', () => {
    expect(joinPath('/a', 'b', 'c.md')).toBe('/a/b/c.md');
  });

  it('avoids doubled separators', () => {
    expect(joinPath('/a/', '/b/', 'c')).toBe('/a/b/c');
  });

  it('joins onto the POSIX root', () => {
    expect(joinPath('/', 'a')).toBe('/a');
  });

  it('keeps the backslash style of a Windows base', () => {
    expect(joinPath('C:\\Users', 'me', 'a.md')).toBe('C:\\Users\\me\\a.md');
    expect(joinPath('C:\\', 'a')).toBe('C:\\a');
  });

  it('joins onto a UNC base', () => {
    expect(joinPath('\\\\server\\share', 'docs')).toBe('\\\\server\\share\\docs');
  });

  it('ignores empty segments', () => {
    expect(joinPath('/a', '', 'b', '/')).toBe('/a/b');
  });

  it('returns the base without trailing slash when there are no segments', () => {
    expect(joinPath('/a/')).toBe('/a');
  });

  it('uses slashes for a mixed-separator base', () => {
    expect(joinPath('/a\\b', 'c')).toBe('/a\\b/c');
  });

  it('uses slashes for a base without any separator', () => {
    expect(joinPath('docs', 'a.md')).toBe('docs/a.md');
  });

  it('drops every trailing separator of the base', () => {
    expect(joinPath('/a//', 'b')).toBe('/a/b');
  });

  it('trims every leading and trailing separator of a segment and keeps inner ones', () => {
    expect(joinPath('/a', '//b')).toBe('/a/b');
    expect(joinPath('/a', 'b//')).toBe('/a/b');
    expect(joinPath('/a', 'b/c')).toBe('/a/b/c');
  });
});

describe('resolvePath', () => {
  it('appends a relative path to the base directory', () => {
    expect(resolvePath('/docs/notes', 'a.md')).toBe('/docs/notes/a.md');
  });

  it('collapses dot and dot-dot segments', () => {
    expect(resolvePath('/docs/notes', './../other/./b.md')).toBe('/docs/other/b.md');
  });

  it('never climbs above the root', () => {
    expect(resolvePath('/docs', '../../../a.md')).toBe('/a.md');
    expect(resolvePath('C:\\docs', '..\\..\\a.md')).toBe('C:/a.md');
  });

  it('lets an absolute path win', () => {
    expect(resolvePath('/docs', '/etc/a.md')).toBe('/etc/a.md');
    expect(resolvePath('/docs', 'D:\\x\\a.md')).toBe('D:/x/a.md');
  });

  it('accepts backslashes and a Windows or UNC base', () => {
    expect(resolvePath('C:\\docs', 'sub\\a.md')).toBe('C:/docs/sub/a.md');
    expect(resolvePath('\\\\server\\share\\docs', '../a.md')).toBe('//server/share/a.md');
  });

  it('resolves against a relative base', () => {
    expect(resolvePath('docs', 'a.md')).toBe('docs/a.md');
  });

  it('takes a drive letter only at the start as a root', () => {
    expect(resolvePath('/docs', 'a/b:/c.md')).toBe('/docs/a/b:/c.md');
  });

  it('returns the base itself for an empty or dot path', () => {
    expect(resolvePath('/docs', '')).toBe('/docs');
    expect(resolvePath('/docs', '.')).toBe('/docs');
  });

  it('adds no separator when nothing is left after the root', () => {
    expect(resolvePath('//server/share', '..')).toBe('//server/share');
    expect(resolvePath('/', '..')).toBe('/');
    expect(resolvePath('docs', '..')).toBe('');
  });
});

describe('retargetPath', () => {
  it('maps a path at or inside the old path', () => {
    expect(retargetPath('/docs/a.md', '/docs', '/x')).toBe('/x/a.md');
    expect(retargetPath('/docs', '/docs', '/x')).toBe('/x');
  });

  it('compares case-sensitively unless asked otherwise', () => {
    expect(retargetPath('/Docs/a.md', '/docs', '/x')).toBe('/Docs/a.md');
    expect(retargetPath('/Docs/a.md', '/docs', '/x', true)).toBe('/x/a.md');
  });
});

describe('isMarkdownPath', () => {
  it.each(['a.md', 'a.markdown', 'a.mdown', 'a.mkd', 'a.txt', '/x/Notes.MD', 'C:\\docs\\a.Txt'])(
    'accepts %s',
    (path) => expect(isMarkdownPath(path)).toBe(true),
  );

  it.each(['a.png', 'a.md.bak', 'md', '/x.md/readme', 'a.mdx', ''])('rejects %s', (path) =>
    expect(isMarkdownPath(path)).toBe(false),
  );
});
