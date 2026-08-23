import { describe, it, expect } from 'vitest';
import { countWords, checkWordCount } from './word-count';

describe('countWords', () => {
  it('counts words separated by varied whitespace', () => {
    expect(countWords('one  two\nthree\tfour')).toBe(4);
  });

  it('is 0 for empty or whitespace-only text', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
  });
});

describe('checkWordCount', () => {
  it('flags a 10-word body as outside the hard sane bound', () => {
    const check = checkWordCount('one two three four five six seven eight nine ten');
    expect(check.withinHardBounds).toBe(false);
  });

  it('accepts a body within the 120-180 target range', () => {
    const body = Array.from({ length: 150 }, (_, i) => `word${i}`).join(' ');
    const check = checkWordCount(body);
    expect(check.withinHardBounds).toBe(true);
    expect(check.withinTarget).toBe(true);
  });

  it('flags a runaway 500-word body as outside the hard sane bound', () => {
    const body = Array.from({ length: 500 }, (_, i) => `word${i}`).join(' ');
    expect(checkWordCount(body).withinHardBounds).toBe(false);
  });
});
