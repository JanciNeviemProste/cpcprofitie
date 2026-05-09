import { describe, expect, it } from 'vitest';
import { crawlDelayFor, isAllowed, parseRobotsTxt } from '../robots';

describe('parseRobotsTxt', () => {
  it('parses User-agent blocks with Disallow/Allow/Crawl-delay', () => {
    const body = `
User-agent: *
Disallow: /admin/
Allow: /admin/public/
Crawl-delay: 2

User-agent: BadBot
Disallow: /
`;
    const robots = parseRobotsTxt(body);
    expect(robots.byAgent['*']?.disallow).toEqual(['/admin/']);
    expect(robots.byAgent['*']?.allow).toEqual(['/admin/public/']);
    expect(robots.byAgent['*']?.crawlDelaySec).toBe(2);
    expect(robots.byAgent['badbot']?.disallow).toEqual(['/']);
  });

  it('ignores comments and blank lines', () => {
    const robots = parseRobotsTxt('# comment\n\nUser-agent: *\nDisallow: /x\n');
    expect(robots.byAgent['*']?.disallow).toEqual(['/x']);
  });
});

describe('isAllowed', () => {
  const robots = parseRobotsTxt(`
User-agent: *
Disallow: /admin/
Allow: /admin/public/
Disallow: /private$
`);

  it('allows the site root', () => {
    expect(isAllowed(robots, 'CPCProfit-Bot/0.1', '/')).toBe(true);
  });

  it('disallows under matching prefix', () => {
    expect(isAllowed(robots, 'CPCProfit-Bot/0.1', '/admin/')).toBe(false);
    expect(isAllowed(robots, 'CPCProfit-Bot/0.1', '/admin/users')).toBe(false);
  });

  it('honours longer Allow over Disallow', () => {
    expect(isAllowed(robots, 'CPCProfit-Bot/0.1', '/admin/public/index.html')).toBe(true);
  });

  it('honours $ end-of-path anchor', () => {
    expect(isAllowed(robots, 'CPCProfit-Bot/0.1', '/private')).toBe(false);
    expect(isAllowed(robots, 'CPCProfit-Bot/0.1', '/private/sub')).toBe(true);
  });

  it('falls back to allow when no rules match the agent', () => {
    const lenient = parseRobotsTxt('User-agent: GoogleBot\nDisallow: /\n');
    expect(isAllowed(lenient, 'CPCProfit-Bot/0.1', '/')).toBe(true);
  });
});

describe('crawlDelayFor', () => {
  it('returns the configured delay for matching UA', () => {
    const robots = parseRobotsTxt('User-agent: *\nCrawl-delay: 5\n');
    expect(crawlDelayFor(robots, 'CPCProfit-Bot/0.1')).toBe(5);
  });

  it('returns undefined when not specified', () => {
    const robots = parseRobotsTxt('User-agent: *\nDisallow: /x\n');
    expect(crawlDelayFor(robots, 'CPCProfit-Bot/0.1')).toBeUndefined();
  });
});
