import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetMemoryBuckets, rateLimit } from '../rate-limit';

describe('rateLimit (memory fallback)', () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    __resetMemoryBuckets();
  });

  afterEach(() => {
    __resetMemoryBuckets();
  });

  it('allows requests up to the limit then denies further ones', async () => {
    for (let i = 0; i < 3; i++) {
      const v = await rateLimit({ key: 'test', limit: 3, windowMs: 60_000 });
      expect(v.allowed).toBe(true);
      expect(v.remaining).toBe(2 - i);
    }
    const blocked = await rateLimit({ key: 'test', limit: 3, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetMs).toBeGreaterThan(0);
  });

  it('isolates buckets per key', async () => {
    await rateLimit({ key: 'a', limit: 1, windowMs: 60_000 });
    const blockedA = await rateLimit({ key: 'a', limit: 1, windowMs: 60_000 });
    const allowedB = await rateLimit({ key: 'b', limit: 1, windowMs: 60_000 });
    expect(blockedA.allowed).toBe(false);
    expect(allowedB.allowed).toBe(true);
  });
});
