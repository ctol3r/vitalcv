/**
 * Runtime channel — formalized 4-value taxonomy.
 *
 * Vercel's `VERCEL_ENV` is a 3-value union (production / preview /
 * development) that conflates two things that matter to operators:
 *
 *   - "operator preview" — per-PR Vercel preview deploy. Ephemeral.
 *     Used by reviewers + dogfooders mid-PR.
 *   - "staging"          — long-running stable deployment that mirrors
 *     production env vars but lives on a different domain. Used for
 *     pre-production verification + partner integration testing.
 *
 * Both map to `VERCEL_ENV=preview` today. That's the ambiguity this
 * module fixes: each runtime context now has a distinct channel id
 * a verifier / monitoring tool / footer can read.
 *
 * The 4 channels:
 *   - 'local_dev'         — `pnpm dev` on a developer machine
 *   - 'operator_preview'  — Vercel per-PR preview deploy
 *   - 'staging'           — long-running staging environment
 *   - 'production'        — live customer-facing deploy
 *
 * Resolution rules (deterministic, no inference):
 *   1. Explicit override via VITALCV_RUNTIME_CHANNEL env var wins.
 *      Allows ops to label a deploy explicitly (e.g., a one-off
 *      audit environment marked as 'staging' even on a preview URL).
 *   2. VERCEL_ENV=production → 'production'.
 *   3. VERCEL_ENV=preview AND VERCEL_URL matches a documented
 *      staging-hostname pattern → 'staging'.
 *      Default pattern: contains 'staging' or 'stage' substring.
 *   4. VERCEL_ENV=preview otherwise → 'operator_preview'.
 *   5. VERCEL_ENV=development → 'local_dev'.
 *   6. Neither set, NODE_ENV=production → 'production' (rare; only
 *      relevant outside Vercel — e.g., self-hosted).
 *   7. Fallback → 'local_dev'.
 *
 * Truth contract:
 *   - Closed union. New channels require explicit code + lockdown.
 *   - Resolution is pure: same env → same channel. No randomness,
 *     no time-dependent logic.
 *   - `narrowRuntimeChannel(unknown)` returns null on unknown input.
 */

export const RUNTIME_CHANNELS = [
  'local_dev',
  'operator_preview',
  'staging',
  'production',
] as const;

export type RuntimeChannel = (typeof RUNTIME_CHANNELS)[number];

export const RUNTIME_CHANNEL_LABEL: Readonly<Record<RuntimeChannel, string>> = Object.freeze({
  local_dev: 'Local development',
  operator_preview: 'Operator preview',
  staging: 'Staging',
  production: 'Production',
});

export interface ResolveRuntimeChannelEnv {
  readonly VITALCV_RUNTIME_CHANNEL?: string;
  readonly VERCEL_ENV?: string;
  readonly VERCEL_URL?: string;
  readonly NODE_ENV?: string;
  /**
   * Optional injection point: a regex string the resolver uses to
   * detect staging URLs when VERCEL_ENV=preview. Defaults to a
   * pattern matching the substring 'staging' or 'stage'.
   */
  readonly VITALCV_STAGING_URL_PATTERN?: string;
}

const DEFAULT_STAGING_PATTERN = /(^|[\.-])(staging|stage)([\.-]|$)/i;

export function resolveRuntimeChannel(
  env: ResolveRuntimeChannelEnv = process.env as ResolveRuntimeChannelEnv,
): RuntimeChannel {
  // 1. Explicit override wins.
  const override = env.VITALCV_RUNTIME_CHANNEL;
  if (typeof override === 'string') {
    const narrowed = narrowRuntimeChannel(override);
    if (narrowed) return narrowed;
  }

  // 2. Vercel production is unambiguous.
  if (env.VERCEL_ENV === 'production') return 'production';

  // 3+4. Disambiguate preview into staging vs operator_preview.
  if (env.VERCEL_ENV === 'preview') {
    const pattern = typeof env.VITALCV_STAGING_URL_PATTERN === 'string'
      ? new RegExp(env.VITALCV_STAGING_URL_PATTERN, 'i')
      : DEFAULT_STAGING_PATTERN;
    if (typeof env.VERCEL_URL === 'string' && pattern.test(env.VERCEL_URL)) {
      return 'staging';
    }
    return 'operator_preview';
  }

  // 5. Vercel dev (rare — Vercel rarely sets this on dev box).
  if (env.VERCEL_ENV === 'development') return 'local_dev';

  // 6. Self-hosted prod.
  if (env.NODE_ENV === 'production') return 'production';

  // 7. Fallback.
  return 'local_dev';
}

export function narrowRuntimeChannel(value: unknown): RuntimeChannel | null {
  if (typeof value !== 'string') return null;
  return (RUNTIME_CHANNELS as readonly string[]).includes(value)
    ? (value as RuntimeChannel)
    : null;
}

/** True iff the channel is a customer-facing live deploy. */
export function isProductionChannel(channel: RuntimeChannel): boolean {
  return channel === 'production';
}

/** True iff the channel is a developer / preview surface (i.e., not customer-facing). */
export function isPreReleaseChannel(channel: RuntimeChannel): boolean {
  return channel === 'local_dev' || channel === 'operator_preview' || channel === 'staging';
}
