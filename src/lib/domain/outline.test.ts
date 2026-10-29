import { describe, expect, it } from 'vitest';
import { activeHeadingIndex, extractOutline, slugify, type Heading } from './outline';

const heading = (level: Heading['level'], text: string, slug: string, line: number): Heading => ({
  level,
  text,
  slug,
  line,
});

describe('slugify', () => {
  it.each([
    ['Hello, World!', 'hello-world'],
    ['Año 2024', 'año-2024'],
    ['C++ & Rust', 'c--rust'],
    ['日本語 の 見出し', '日本語-の-見出し'],
    ['snake_case and kebab-case', 'snake_case-and-kebab-case'],
    ['Ünïcödé Çafé', 'ünïcödé-çafé'],
    ['What is this?', 'what-is-this'],
    ['  padded  ', '--padded--'],
    ['', 'section'],
    ['!!!', 'section'],
  ])('slugifies %j as %j', (text, expected) => {
    expect(slugify(text)).toBe(expected);
  });
});

describe('extractOutline', () => {
  it('returns nothing for an empty document', () => {
    expect(extractOutline('')).toEqual([]);
  });

  it('extracts ATX headings of every level with their lines', () => {
    const md = '# One\n## Two\n### Three\n#### Four\n##### Five\n###### Six';
    expect(extractOutline(md)).toEqual([
      heading(1, 'One', 'one', 0),
      heading(2, 'Two', 'two', 1),
      heading(3, 'Three', 'three', 2),
      heading(4, 'Four', 'four', 3),
      heading(5, 'Five', 'five', 4),
      heading(6, 'Six', 'six', 5),
    ]);
  });

  it('ignores seven hashes, missing space and four-space indentation', () => {
    expect(extractOutline('####### x\n#hashtag\n    # indented')).toEqual([]);
  });

  it('accepts up to three leading spaces', () => {
    expect(extractOutline('   ## Indented')).toEqual([heading(2, 'Indented', 'indented', 0)]);
  });

  it('accepts an empty heading and slugs it as section', () => {
    expect(extractOutline('#\n## ##')).toEqual([
      heading(1, '', 'section', 0),
      heading(2, '', 'section-1', 1),
    ]);
  });

  it('strips the optional closing hashes', () => {
    expect(extractOutline('## Title ##\n# C# #')).toEqual([
      heading(2, 'Title', 'title', 0),
      heading(1, 'C#', 'c', 1),
    ]);
  });

  it('keeps hashes that are not a closing sequence', () => {
    expect(extractOutline('# a#b')).toEqual([heading(1, 'a#b', 'ab', 0)]);
  });

  it('strips inline Markdown from the text', () => {
    const md = [
      '# **Bold** and *italic* and ~~gone~~',
      '# Use `npm run *` now',
      '# [Link](http://x.y) and ![alt](i.png)',
      '# A <span class="a">tag</span> here',
      '# snake_case and _emphasis_ and __strong__',
      String.raw`# Escaped \*star\*`,
      '# [ref][1] link',
    ].join('\n');
    expect(extractOutline(md).map((h) => h.text)).toEqual([
      'Bold and italic and gone',
      'Use npm run * now',
      'Link and alt',
      'A tag here',
      'snake_case and emphasis and strong',
      'Escaped *star*',
      'ref link',
    ]);
  });

  it('extracts Setext headings at the first line of their paragraph', () => {
    const md = 'Title\n=====\n\nSub\n---\n\nMulti\nline\n===';
    expect(extractOutline(md)).toEqual([
      heading(1, 'Title', 'title', 0),
      heading(2, 'Sub', 'sub', 3),
      heading(1, 'Multi line', 'multi-line', 6),
    ]);
  });

  it('treats --- after a blank line as a thematic break', () => {
    expect(extractOutline('Text\n\n---\n\nMore')).toEqual([]);
  });

  it('does not make a Setext heading out of lists, quotes, headings or code', () => {
    const md = ['- item', '---', '> quote', '---', '# ATX', '---', '    code', '---'].join('\n');
    expect(extractOutline(md)).toEqual([heading(1, 'ATX', 'atx', 4)]);
  });

  it('does not reuse a Setext underline as paragraph text', () => {
    expect(extractOutline('Title\n===\n---')).toEqual([heading(1, 'Title', 'title', 0)]);
  });

  it('accepts a short underline and trailing spaces', () => {
    expect(extractOutline('Title\n-  ')).toEqual([heading(2, 'Title', 'title', 0)]);
  });

  it('ignores headings inside fenced code', () => {
    const md = '# Real\n```\n# not\nText\n---\n```\n~~~\n## nope\n~~~\n## After';
    expect(extractOutline(md)).toEqual([
      heading(1, 'Real', 'real', 0),
      heading(2, 'After', 'after', 9),
    ]);
  });

  it('does not pair a paragraph before a fence with an underline after it', () => {
    expect(extractOutline('text\n```\ncode\n```\n---')).toEqual([]);
  });

  it('skips the front matter and offsets lines to the original document', () => {
    const md = '---\ntitle: # not a heading\n---\n\n# Real\n\nSetext\n---';
    expect(extractOutline(md)).toEqual([
      heading(1, 'Real', 'real', 4),
      heading(2, 'Setext', 'setext', 6),
    ]);
  });

  it('handles CRLF line endings', () => {
    const md = '---\r\na: 1\r\n---\r\n# One\r\n\r\nTwo\r\n===\r\n';
    expect(extractOutline(md)).toEqual([heading(1, 'One', 'one', 3), heading(1, 'Two', 'two', 5)]);
  });

  it('numbers duplicate slugs in document order', () => {
    const md = '# Intro\n## Intro\n## Intro\n# Other';
    expect(extractOutline(md).map((h) => h.slug)).toEqual(['intro', 'intro-1', 'intro-2', 'other']);
  });

  it('avoids collisions with an explicit numbered heading like github-slugger', () => {
    const md = '# a\n# a-1\n# a';
    expect(extractOutline(md).map((h) => h.slug)).toEqual(['a', 'a-1', 'a-2']);
  });

  it('keeps Unicode in slugs', () => {
    expect(extractOutline('# Año 2024\n# 日本語')[0]?.slug).toBe('año-2024');
    expect(extractOutline('# 日本語')[0]?.slug).toBe('日本語');
  });
});

describe('activeHeadingIndex', () => {
  const outline = [heading(1, 'A', 'a', 2), heading(2, 'B', 'b', 10), heading(2, 'C', 'c', 20)];

  it('returns -1 before the first heading', () => {
    expect(activeHeadingIndex(outline, 1)).toBe(-1);
  });

  it('returns -1 for an empty outline', () => {
    expect(activeHeadingIndex([], 5)).toBe(-1);
  });

  it('includes a heading that starts exactly at the top line', () => {
    expect(activeHeadingIndex(outline, 2)).toBe(0);
    expect(activeHeadingIndex(outline, 10)).toBe(1);
  });

  it('returns the last heading that already started', () => {
    expect(activeHeadingIndex(outline, 19)).toBe(1);
    expect(activeHeadingIndex(outline, 500)).toBe(2);
  });
});

describe('extractOutline: exact inline and block rules', () => {
  const texts = (markdown: string) => extractOutline(markdown).map((h) => h.text);

  it('strips emphasis that spans several words', () => {
    expect(texts('# **bold text**')).toEqual(['bold text']);
    expect(texts('# ~~gone now~~')).toEqual(['gone now']);
    expect(texts('# *two words*')).toEqual(['two words']);
    expect(texts('# _two words_')).toEqual(['two words']);
  });

  it('strips underscore emphasis at the very start of the heading', () => {
    expect(texts('# _lead_ text')).toEqual(['lead text']);
  });

  it('keeps the text of a full reference link', () => {
    expect(texts('# See [docs][ref]')).toEqual(['See docs']);
  });

  it('trims code spans and the resulting text', () => {
    expect(texts('# Use ` code ` now')).toEqual(['Use code now']);
    expect(texts('# Title <br>')).toEqual(['Title']);
  });

  it('keeps a backtick inside a double-backtick code span', () => {
    expect(texts('# ``a`b``')).toEqual(['a`b']);
  });

  it('strips only a closing sequence at the very end', () => {
    expect(texts('# A # B')).toEqual(['A # B']);
    expect(texts('# a #b')).toEqual(['a #b']);
  });

  it('joins the trimmed lines of a Setext paragraph with one space', () => {
    expect(texts('Hello\n  world\n===')).toEqual(['Hello world']);
  });

  it('ends a paragraph at a whitespace-only line', () => {
    expect(extractOutline('Para\n   \n---')).toEqual([]);
  });

  it('accepts only a whole line of = or - as a Setext underline', () => {
    expect(extractOutline('Title\n=== x')).toEqual([]);
    expect(extractOutline('Title\nfoo ==')).toEqual([]);
  });

  it('takes lines that only look like block starts later on as paragraph text', () => {
    expect(extractOutline('a > b\n===')).toEqual([heading(1, 'a > b', 'a--b', 0)]);
    expect(extractOutline(' Indented one\n===')).toEqual([
      heading(1, 'Indented one', 'indented-one', 0),
    ]);
    expect(extractOutline('12 apples\n===')).toEqual([heading(1, '12 apples', '12-apples', 0)]);
    expect(extractOutline('_\n===')).toEqual([heading(1, '_', '_', 0)]);
    expect(texts('--- notes\n===')).toEqual(['--- notes']);
  });

  it('does not make a Setext heading out of ordered lists or thematic breaks', () => {
    expect(extractOutline('1. item\n===')).toEqual([]);
    expect(extractOutline('10. item\n===')).toEqual([]);
    expect(extractOutline('1) item\n===')).toEqual([]);
    expect(extractOutline('***\n===')).toEqual([]);
    expect(extractOutline('_ _ _\n===')).toEqual([]);
  });

  it('does not make a Setext heading out of multi-hash or empty ATX headings', () => {
    expect(extractOutline('## ATX\n---')).toEqual([heading(2, 'ATX', 'atx', 0)]);
    expect(extractOutline('#\n===')).toEqual([heading(1, '', 'section', 0)]);
  });
});
