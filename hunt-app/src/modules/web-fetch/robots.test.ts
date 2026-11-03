import { describe, it, expect } from 'vitest';
import { parseRobotsTxt, isAllowed, crawlDelayFor } from './robots';

describe('parseRobotsTxt', () => {
  it('parses a simple wildcard group', () => {
    const rules = parseRobotsTxt('User-agent: *\nDisallow: /search\nAllow: /\n');
    expect(rules.groups).toHaveLength(1);
    expect(rules.groups[0].agents).toEqual(['*']);
    expect(rules.groups[0].disallow).toEqual(['/search']);
    expect(rules.groups[0].allow).toEqual(['/']);
  });

  it('groups consecutive User-agent lines with no rule between them', () => {
    const rules = parseRobotsTxt('User-agent: a\nUser-agent: b\nDisallow: /x\n');
    expect(rules.groups).toHaveLength(1);
    expect(rules.groups[0].agents).toEqual(['a', 'b']);
  });

  it('starts a new group once a rule has been seen since the last user-agent', () => {
    const rules = parseRobotsTxt('User-agent: a\nDisallow: /x\nUser-agent: b\nDisallow: /y\n');
    expect(rules.groups).toHaveLength(2);
    expect(rules.groups[0].agents).toEqual(['a']);
    expect(rules.groups[1].agents).toEqual(['b']);
  });

  it('ignores comments and blank lines', () => {
    const rules = parseRobotsTxt('# comment\nUser-agent: *\n\nDisallow: /x # trailing comment\n');
    expect(rules.groups[0].disallow).toEqual(['/x']);
  });

  it('parses crawl-delay as a number', () => {
    const rules = parseRobotsTxt('User-agent: *\nCrawl-delay: 5\n');
    expect(rules.groups[0].crawlDelay).toBe(5);
  });

  it('collects sitemap lines regardless of group', () => {
    const rules = parseRobotsTxt('Sitemap: https://example.com/sitemap.xml\nUser-agent: *\n');
    expect(rules.sitemaps).toEqual(['https://example.com/sitemap.xml']);
  });
});

describe('isAllowed', () => {
  it('allows any path when there are no rules at all', () => {
    const rules = parseRobotsTxt('');
    expect(isAllowed(rules, 'HUNT-Contract-Acquisition-OS/1.0', '/anything')).toBe(true);
  });

  // The real finding this module exists to encode: AWS Partner Solutions
  // Finder disallows exactly the path its own directory search needs.
  it('disallows a path matched by a Disallow rule under the wildcard group', () => {
    const rules = parseRobotsTxt('User-agent: *\nAllow: /\nDisallow: /search\n');
    expect(isAllowed(rules, 'HUNT-Contract-Acquisition-OS/1.0', '/search')).toBe(false);
    expect(isAllowed(rules, 'HUNT-Contract-Acquisition-OS/1.0', '/about')).toBe(true);
  });

  it('an equal-length Allow beats an equal-length Disallow', () => {
    const rules = parseRobotsTxt('User-agent: *\nDisallow: /x\nAllow: /x\n');
    expect(isAllowed(rules, 'HUNT-Contract-Acquisition-OS/1.0', '/x')).toBe(true);
  });

  it('the longer, more specific rule wins regardless of order', () => {
    const rules = parseRobotsTxt('User-agent: *\nAllow: /x/y\nDisallow: /x\n');
    expect(isAllowed(rules, 'HUNT-Contract-Acquisition-OS/1.0', '/x/y/z')).toBe(true);
    expect(isAllowed(rules, 'HUNT-Contract-Acquisition-OS/1.0', '/x/other')).toBe(false);
  });

  it('an empty Disallow value means disallow nothing', () => {
    const rules = parseRobotsTxt('User-agent: *\nDisallow:\n');
    expect(isAllowed(rules, 'HUNT-Contract-Acquisition-OS/1.0', '/anything')).toBe(true);
  });

  it('prefers a named group over the wildcard group when our agent is named', () => {
    const rules = parseRobotsTxt(
      'User-agent: HUNT-Contract-Acquisition-OS\nDisallow: /only-for-us\nUser-agent: *\nDisallow: /\n'
    );
    // The wildcard group disallows everything, but our named group's rules
    // are used instead once our agent has its own group.
    expect(isAllowed(rules, 'HUNT-Contract-Acquisition-OS/1.0', '/anything-else')).toBe(true);
    expect(isAllowed(rules, 'HUNT-Contract-Acquisition-OS/1.0', '/only-for-us')).toBe(false);
  });
});

describe('crawlDelayFor', () => {
  it('returns the wildcard group crawl-delay when present', () => {
    const rules = parseRobotsTxt('User-agent: *\nCrawl-delay: 10\n');
    expect(crawlDelayFor(rules, 'HUNT-Contract-Acquisition-OS/1.0')).toBe(10);
  });

  it('returns undefined when no crawl-delay is specified', () => {
    const rules = parseRobotsTxt('User-agent: *\nAllow: /\n');
    expect(crawlDelayFor(rules, 'HUNT-Contract-Acquisition-OS/1.0')).toBeUndefined();
  });
});
