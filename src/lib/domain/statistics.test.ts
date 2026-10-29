import { describe, expect, it } from 'vitest';
import { computeStatistics } from './statistics';

const words = (markdown: string) => computeStatistics(markdown).words;

describe('computeStatistics: empty and structure', () => {
  it('reports zeros and one line for an empty document', () => {
    expect(computeStatistics('')).toEqual({
      words: 0,
      characters: 0,
      charactersNoSpaces: 0,
      lines: 1,
      readingMinutes: 0,
    });
  });

  it('counts lines like an editor: a trailing newline adds an empty line', () => {
    expect(computeStatistics('a').lines).toBe(1);
    expect(computeStatistics('a\n').lines).toBe(2);
    expect(computeStatistics('a\r\nb\rc\nd').lines).toBe(4);
  });

  it('counts a document with only front matter as having no words', () => {
    const stats = computeStatistics('---\ntitle: Hello world\ntags: [a, b]\n---\n');
    expect(stats.words).toBe(0);
    expect(stats.characters).toBe(0);
    expect(stats.lines).toBe(5);
  });

  it('ignores the front matter but counts the body', () => {
    expect(words('---\ntitle: Many words in front matter\n---\nOne two')).toBe(2);
  });
});

describe('computeStatistics: words and characters', () => {
  it('counts English words and characters', () => {
    const stats = computeStatistics('Hello brave world');
    expect(stats.words).toBe(3);
    expect(stats.characters).toBe(17);
    expect(stats.charactersNoSpaces).toBe(15);
  });

  it('counts Spanish words with accents and punctuation', () => {
    const stats = computeStatistics('¿Cómo estás, niño? ¡Muy bien!');
    expect(stats.words).toBe(5);
    expect(stats.charactersNoSpaces).toBe(25);
  });

  it('counts CJK text by word segmentation, not by spaces', () => {
    const stats = computeStatistics('今天天气很好');
    expect(stats.words).toBeGreaterThan(1);
    expect(stats.words).toBeLessThan(6);
    expect(stats.characters).toBe(6);
  });

  it('counts an emoji with a skin tone as one character', () => {
    const stats = computeStatistics('👍🏽');
    expect(stats.characters).toBe(1);
    expect(stats.charactersNoSpaces).toBe(1);
    expect(stats.words).toBe(0);
  });

  it('follows the segmenter for hyphenated words', () => {
    expect(words('well-known')).toBe(2);
  });

  it('counts the line break between lines as a character with spaces only', () => {
    const stats = computeStatistics('ab\ncd');
    expect(stats.characters).toBe(5);
    expect(stats.charactersNoSpaces).toBe(4);
  });

  it('handles CRLF documents', () => {
    const stats = computeStatistics('ab\r\ncd');
    expect(stats.words).toBe(2);
    expect(stats.charactersNoSpaces).toBe(4);
  });
});

describe('computeStatistics: Markdown syntax', () => {
  it('drops heading markers', () => {
    expect(computeStatistics('## Title here').characters).toBe(10);
  });

  it('drops emphasis, strikethrough and highlight markers', () => {
    const stats = computeStatistics('**bold** _it_ ~~gone~~ ==mark==');
    expect(stats.words).toBe(4);
    expect(stats.charactersNoSpaces).toBe(14);
  });

  it('keeps underscores inside identifiers', () => {
    expect(computeStatistics('snake_case').characters).toBe(10);
  });

  it('keeps the text of inline code without backticks', () => {
    const stats = computeStatistics('use `npm run` now');
    expect(stats.words).toBe(4);
    expect(stats.characters).toBe(15);
  });

  it('keeps link text and drops the destination', () => {
    const stats = computeStatistics('[the docs](https://example.com/very/long/path) here');
    expect(stats.words).toBe(3);
    expect(stats.characters).toBe(13);
  });

  it('keeps image alt text', () => {
    expect(computeStatistics('![a cat](cat.png)').characters).toBe(5);
    expect(words('![a cat](cat.png)')).toBe(2);
  });

  it('keeps the text of reference links', () => {
    expect(computeStatistics('[the docs][d]').characters).toBe(8);
  });

  it('counts a bare URL as one word', () => {
    expect(words('see https://example.com/a/b?c=d now')).toBe(3);
  });

  it('counts an autolink as one word', () => {
    expect(words('see <https://example.com/a/b> now')).toBe(3);
  });

  it('removes HTML tags but keeps their text', () => {
    const stats = computeStatistics('<div class="x">hi <b>you</b></div>');
    expect(stats.words).toBe(2);
    expect(stats.characters).toBe(6);
  });

  it('keeps comparisons that are not HTML tags', () => {
    expect(computeStatistics('1 < 2 > 0').charactersNoSpaces).toBe(5);
  });

  it.each(['- item one', '* item one', '+ item one', '1. item one', '2) item one'])(
    'drops the list marker of %s',
    (line) => {
      expect(computeStatistics(line).characters).toBe(8);
    },
  );

  it('drops nested blockquote markers', () => {
    expect(computeStatistics('> > quoted').characters).toBe(6);
  });

  it('drops task boxes', () => {
    expect(computeStatistics('- [ ] todo').characters).toBe(4);
    expect(computeStatistics('- [x] done').characters).toBe(4);
  });

  it('drops footnote references', () => {
    expect(computeStatistics('claim[^1] stands').characters).toBe(12);
  });

  it('ignores thematic breaks and setext underlines', () => {
    const stats = computeStatistics('Title\n=====\n\n---\ntext');
    expect(stats.words).toBe(2);
    expect(stats.characters).toBe(10);
  });
});

describe('computeStatistics: tables and code blocks', () => {
  it('drops table pipes and the alignment row', () => {
    const stats = computeStatistics('| a | b |\n| :-- | --: |\n| c | d |');
    expect(stats.words).toBe(4);
    expect(stats.charactersNoSpaces).toBe(4);
  });

  it('excludes fenced code blocks entirely from words and characters', () => {
    const stats = computeStatistics('before\n```ts\nconst answer = 42;\n```\nafter');
    expect(stats.words).toBe(2);
    expect(stats.charactersNoSpaces).toBe(11);
    expect(stats.lines).toBe(5);
  });

  it('excludes tilde fences and unclosed fences', () => {
    expect(words('a\n~~~\ncode here\n~~~\nb')).toBe(2);
    expect(words('a\n```\ncode here')).toBe(1);
  });
});

describe('computeStatistics: reading time', () => {
  const text = (count: number) => Array.from({ length: count }, () => 'word').join(' ');

  it('rounds up to the next minute', () => {
    expect(computeStatistics(text(1)).readingMinutes).toBe(1);
    expect(computeStatistics(text(230)).readingMinutes).toBe(1);
    expect(computeStatistics(text(231)).readingMinutes).toBe(2);
  });

  it('uses the given words per minute', () => {
    expect(computeStatistics(text(100), 50).readingMinutes).toBe(2);
    expect(computeStatistics(text(101), 50).readingMinutes).toBe(3);
  });
});

describe('computeStatistics: exact syntax boundaries', () => {
  const characters = (markdown: string) => computeStatistics(markdown).characters;

  it('turns a table pipe into a word break', () => {
    expect(words('a|b')).toBe(2);
    expect(characters('a|b')).toBe(3);
  });

  it('drops indented, tight and nested blockquote markers', () => {
    expect(characters('  > quoted')).toBe(6);
    expect(characters('>quoted')).toBe(6);
    expect(characters('>>quoted')).toBe(6);
  });

  it('drops multi-digit list numbers and every space after a marker', () => {
    expect(characters('10. item')).toBe(4);
    expect(characters('-   item')).toBe(4);
  });

  it('drops task boxes only at the start of a line, with all their trailing spaces', () => {
    expect(characters('  [x] done')).toBe(4);
    expect(characters('- [x]   done')).toBe(4);
    expect(characters('see [x] here')).toBe(12);
  });

  it('drops heading markers only at the start of a line, with all their spaces', () => {
    expect(characters('  # Title')).toBe(5);
    expect(characters('#   Title')).toBe(5);
    expect(characters('a # b')).toBe(5);
  });

  it('keeps the text of a collapsed reference link', () => {
    expect(characters('[text][]')).toBe(4);
  });

  it('drops footnote references with long labels', () => {
    expect(characters('a[^12]')).toBe(1);
  });

  it('keeps plain http autolinks and bare URLs as one word', () => {
    expect(words('<http://example.com>')).toBe(1);
    expect(characters('<http://example.com>')).toBe(18);
    expect(words('see http://example.com/a/b')).toBe(2);
  });

  it('keeps a single equals sign, which is not a highlight marker', () => {
    expect(characters('a = b')).toBe(5);
  });
});
