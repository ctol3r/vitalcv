/**
 * AI-route guardrails — bounds worst-case model spend.
 *
 * Every AI endpoint requires a signed-in Clerk user and passes through two
 * caps before any Anthropic call:
 *   - per-user sliding window (default 20 calls/hour), and
 *   - a global daily ceiling (default 500 calls/day across all users),
 * so even under abuse the daily spend is bounded (~$10-15/day at Opus rates;
 * typical usage is pennies). In-memory is correct here: the web app runs as a
 * single long-lived Railway process, and the caps are safety bounds, not
 * billing-grade metering. Tunable via env (AI_CALLS_PER_USER_PER_HOUR,
 * AI_CALLS_GLOBAL_PER_DAY).
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

const perUser = new Map<string, number[]>();
let globalDay: number[] = [];

export type AiLimitResult = { ok: true } | { ok: false; reason: string };

export function checkAiLimit(userId: string): AiLimitResult {
  const now = Date.now();
  const userMax = envInt('AI_CALLS_PER_USER_PER_HOUR', 20);
  const globalMax = envInt('AI_CALLS_GLOBAL_PER_DAY', 500);

  globalDay = globalDay.filter((t) => now - t < DAY_MS);
  if (globalDay.length >= globalMax) {
    return { ok: false, reason: 'AI is at its daily capacity. Try again tomorrow.' };
  }

  const mine = (perUser.get(userId) ?? []).filter((t) => now - t < HOUR_MS);
  if (mine.length >= userMax) {
    perUser.set(userId, mine);
    return { ok: false, reason: 'You have reached the hourly AI limit. Try again in a bit.' };
  }

  mine.push(now);
  perUser.set(userId, mine);
  globalDay.push(now);

  // Opportunistic cleanup so the map can't grow unboundedly.
  if (perUser.size > 5000) {
    for (const [k, v] of perUser) {
      if (v.every((t) => now - t >= HOUR_MS)) perUser.delete(k);
    }
  }

  return { ok: true };
}

/** Test hook — reset all counters. */
export function resetAiLimits(): void {
  perUser.clear();
  globalDay = [];
}
