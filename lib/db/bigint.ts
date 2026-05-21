// Safe BigInt conversion that doesn't lose precision for ids >= 2^53.
// Drizzle returns bigserial ids as either bigint, string, or number depending
// on the driver/runtime. `BigInt(Number(x))` truncates for x >= 9_007_199_254_740_993.

export function toBigInt(v: unknown): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'string') return BigInt(v);
  if (typeof v === 'number') {
    if (!Number.isSafeInteger(v)) {
      throw new Error(`toBigInt: number ${v} is not a safe integer; pass string instead`);
    }
    return BigInt(v);
  }
  throw new Error(`toBigInt: unsupported type ${typeof v}`);
}
