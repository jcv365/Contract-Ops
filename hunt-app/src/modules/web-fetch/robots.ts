// A minimal robots.txt parser/evaluator (RFC 9309 subset) — no network
// access here, that's client.ts/compliance.ts. Deliberately small: this
// engine only ever needs to answer "may I GET this one path", not build a
// full crawler.
export interface RobotsGroup {
  agents: string[];
  allow: string[];
  disallow: string[];
  crawlDelay?: number;
}

export interface RobotsRules {
  groups: RobotsGroup[];
  sitemaps: string[];
}

const OUR_AGENT = 'HUNT-Contract-Acquisition-OS';

export function parseRobotsTxt(text: string): RobotsRules {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let sawRuleSinceLastAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;

    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    switch (field) {
      case 'user-agent': {
        // Consecutive `User-agent:` lines with no rule in between belong to
        // the SAME group (RFC 9309 §2.2.1) — only start a new group once a
        // rule line has been seen since the last user-agent line.
        if (!current || sawRuleSinceLastAgent) {
          current = { agents: [], allow: [], disallow: [] };
          groups.push(current);
          sawRuleSinceLastAgent = false;
        }
        current.agents.push(value.toLowerCase());
        break;
      }
      case 'allow':
        if (current && value) current.allow.push(value);
        sawRuleSinceLastAgent = true;
        break;
      case 'disallow':
        if (current && value) current.disallow.push(value);
        sawRuleSinceLastAgent = true;
        break;
      case 'crawl-delay':
        if (current) {
          const seconds = Number(value);
          if (Number.isFinite(seconds) && seconds >= 0) current.crawlDelay = seconds;
        }
        sawRuleSinceLastAgent = true;
        break;
      case 'sitemap':
        if (value) sitemaps.push(value);
        break;
      default:
        break;
    }
  }

  return { groups, sitemaps };
}

function matchesAgent(group: RobotsGroup, userAgentLower: string): boolean {
  return group.agents.some((a) => a === '*' || userAgentLower.includes(a));
}

// Longest-matching-path-prefix wins (RFC 9309 §2.2.2); an equal-length
// Allow beats an equal-length Disallow. No rule at all for the path means
// allowed.
export function isAllowed(rules: RobotsRules, userAgent: string, pathname: string): boolean {
  const userAgentLower = userAgent.toLowerCase();
  const named = rules.groups.filter((g) => matchesAgent(g, userAgentLower) && !g.agents.includes('*'));
  const wildcard = rules.groups.filter((g) => g.agents.includes('*'));
  const applicable = named.length > 0 ? named : wildcard;

  let bestLength = -1;
  let bestAllow = true;

  for (const group of applicable) {
    for (const rule of group.disallow) {
      if (rule === '') continue; // an empty Disallow means "disallow nothing"
      if (pathname.startsWith(rule) && rule.length > bestLength) {
        bestLength = rule.length;
        bestAllow = false;
      }
    }
    for (const rule of group.allow) {
      if (pathname.startsWith(rule) && rule.length >= bestLength) {
        bestLength = rule.length;
        bestAllow = true;
      }
    }
  }

  return bestAllow;
}

export function crawlDelayFor(rules: RobotsRules, userAgent: string): number | undefined {
  const userAgentLower = userAgent.toLowerCase();
  const named = rules.groups.find((g) => matchesAgent(g, userAgentLower) && !g.agents.includes('*'));
  if (named?.crawlDelay != null) return named.crawlDelay;
  const wildcard = rules.groups.find((g) => g.agents.includes('*'));
  return wildcard?.crawlDelay;
}

export { OUR_AGENT };
