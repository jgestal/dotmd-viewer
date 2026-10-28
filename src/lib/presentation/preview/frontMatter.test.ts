import { describe, expect, it } from 'vitest';
import { parseFrontMatter } from './frontMatter';

describe('parseFrontMatter', () => {
  it('reads simple key: value lines', () => {
    expect(parseFrontMatter('title: Welcome\ntags: [demo, a]')).toEqual([
      { key: 'title', value: 'Welcome' },
      { key: 'tags', value: '[demo, a]' },
    ]);
  });

  it('strips matching quotes only', () => {
    expect(parseFrontMatter('a: "x y"\nb: \'z\'\nc: "open')).toEqual([
      { key: 'a', value: 'x y' },
      { key: 'b', value: 'z' },
      { key: 'c', value: '"open' },
    ]);
  });

  it('keeps colons inside the value', () => {
    expect(parseFrontMatter('time: 10:30')).toEqual([{ key: 'time', value: '10:30' }]);
  });

  it('skips comments, nested keys, list items and keys without a value', () => {
    expect(parseFrontMatter('# note\nauthor:\n  name: X\n- item\nok: yes')).toEqual([
      { key: 'ok', value: 'yes' },
    ]);
  });

  it('handles CRLF and empty input', () => {
    expect(parseFrontMatter('a: 1\r\nb: 2')).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ]);
    expect(parseFrontMatter('')).toEqual([]);
  });
});
