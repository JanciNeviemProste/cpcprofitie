// Token-bucket rate limiter. Backed by Upstash Redis when env is wired,
// in-memory Map otherwise (process-local — fine for dev, useless across
// regions in prod). Returns whether the request is allowed and how long the
// caller should wait if not.

export type RateLimitVerdict = {
  allowed: boolean;
  remaining: number;
  resetMs: number;
};

const FALLBACK_BUCKETS = new Map<string, { tokens: number; resetAt: number }>();

export type RateLimitOptions = {
  /** Bucket key — typically `${endpoint}:${userId|ip}`. */
  key: string;
  /** Maximum tokens allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitVerdict> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) {
    return upstashRateLimit(opts, upstashUrl, upstashToken);
  }
  return memoryRateLimit(opts);
}

function memoryRateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitVerdict {
  const now = Date.now();
  const bucket = FALLBACK_BUCKETS.get(key);
  if (!bucket || bucket.resetAt <= now) {
    FALLBACK_BUCKETS.set(key, { tokens: limit - 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetMs: windowMs };
  }
  if (bucket.tokens <= 0) {
    return { allowed: false, remaining: 0, resetMs: bucket.resetAt - now };
  }
  bucket.tokens -= 1;
  return { allowed: true, remaining: bucket.tokens, resetMs: bucket.resetAt - now };
}

async function upstashRateLimit(
  { key, limit, windowMs }: RateLimitOptions,
  url: string,
  token: string,
): Promise<RateLimitVerdict> {
  // INCR + EXPIRE pipeline — simple fixed-window counter. Good enough for the
  // protection use-case; swap for sliding-window if/when @upstash/ratelimit is
  // added as a dependency.
  const windowKey = `rl:${key}:${Math.floor(Date.now() / windowMs)}`;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', windowKey],
        ['PEXPIRE', windowKey, windowMs.toString()],
      ]),
    });
    if (!res.ok) {
      // fail-open on infra issues so we don't break user requests
      return { allowed: true, remaining: limit, resetMs: windowMs };
    }
    const [{ result: count }] = (await res.json()) as { result: number }[];
    const remaining = Math.max(0, limit - count);
    return {
      allowed: count <= limit,
      remaining,
      resetMs: windowMs - (Date.now() % windowMs),
    };
  } catch {
    return { allowed: true, remaining: limit, resetMs: windowMs };
  }
}

/** Resets the in-memory fallback — used by tests. */
export function __resetMemoryBuckets() {
  FALLBACK_BUCKETS.clear();
}
