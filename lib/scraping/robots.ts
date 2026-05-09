// Minimal robots.txt parser. Handles User-agent, Disallow, Allow,
// Crawl-delay. The first matching User-agent block wins (with `*` as
// fallback). Path matches use prefix semantics with optional `*` wildcard
// and trailing `$` anchor.

export type RobotsRules = {
  disallow: string[];
  allow: string[];
  crawlDelaySec?: number;
};

export type RobotsTxt = {
  byAgent: Record<string, RobotsRules>;
};

export function parseRobotsTxt(body: string): RobotsTxt {
  const result: RobotsTxt = { byAgent: {} };
  let current: string[] = [];
  let lastWasUserAgent = false;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) {
      // Blank line ends the current group — next User-agent starts fresh.
      lastWasUserAgent = false;
      continue;
    }
    const [rawKey, ...rest] = line.split(':');
    if (!rawKey || rest.length === 0) continue;
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();

    if (key === 'user-agent') {
      const agent = value.toLowerCase();
      // Adjacent User-agent lines accumulate into one group; an isolated
      // User-agent after rules starts a new group.
      if (!lastWasUserAgent) current = [];
      current.push(agent);
      if (!result.byAgent[agent]) result.byAgent[agent] = { disallow: [], allow: [] };
      lastWasUserAgent = true;
      continue;
    }

    lastWasUserAgent = false;
    if (current.length === 0) continue;

    for (const agent of current) {
      const rules = result.byAgent[agent]!;
      if (key === 'disallow' && value) rules.disallow.push(value);
      else if (key === 'allow' && value) rules.allow.push(value);
      else if (key === 'crawl-delay' && value) {
        const n = Number(value);
        if (Number.isFinite(n) && n >= 0) rules.crawlDelaySec = n;
      }
      // sitemap and unknown directives are intentionally ignored
    }
  }
  return result;
}

function pathMatchesRule(path: string, rule: string): boolean {
  if (!rule) return false;
  // Convert robots.txt pattern to regex: `*` → `.*`, `$` at end → end anchor.
  const anchored = rule.endsWith('$');
  const stripped = anchored ? rule.slice(0, -1) : rule;
  const regex = new RegExp(
    '^' +
      stripped
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*') +
      (anchored ? '$' : ''),
  );
  return regex.test(path);
}

export function isAllowed(robots: RobotsTxt, userAgent: string, path: string): boolean {
  const lowerAgent = userAgent.toLowerCase();
  // Pick the most specific matching agent block, else `*`, else default-allow.
  const candidates = Object.keys(robots.byAgent).filter(
    (a) => a === '*' || lowerAgent.includes(a) || a.includes(lowerAgent),
  );
  const exact = candidates.find((a) => a !== '*');
  const block = robots.byAgent[exact ?? '*'];
  if (!block) return true;
  // Longer Allow trumps shorter Disallow, and vice versa, per RFC.
  const matchLen = (rules: string[]) =>
    rules
      .filter((r) => pathMatchesRule(path, r))
      .reduce((max, r) => Math.max(max, r.length), -1);
  const allowLen = matchLen(block.allow);
  const disallowLen = matchLen(block.disallow);
  if (disallowLen === -1) return true;
  if (allowLen === -1) return false;
  return allowLen >= disallowLen;
}

export function crawlDelayFor(robots: RobotsTxt, userAgent: string): number | undefined {
  const lowerAgent = userAgent.toLowerCase();
  const exact = Object.keys(robots.byAgent).find(
    (a) => a !== '*' && (lowerAgent.includes(a) || a.includes(lowerAgent)),
  );
  return robots.byAgent[exact ?? '*']?.crawlDelaySec;
}
