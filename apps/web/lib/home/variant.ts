/**
 * Which homepage `/` serves — Wave 1075.
 *
 * The One Real Loop replaces the evidence film at the root. The film is not
 * deleted: it stays a tested, one-env-var rollback so an incident is contained
 * by a redeploy rather than by writing code under pressure.
 *
 * Resolved on the SERVER, once, before render. There is no client-side switch
 * and therefore no flash between variants, and the HTML a crawler receives is
 * the HTML a visitor receives.
 *
 * Unknown or absent values fall back to `film` — the variant that has been
 * serving production. A typo in an env var must not decide what the homepage
 * is; it should leave it where it was and be visible in the logs.
 */

export const HOME_VARIANTS = ['career-loop', 'film'] as const;
export type HomeVariant = (typeof HOME_VARIANTS)[number];

/** What ships when nothing is configured. */
export const DEFAULT_HOME_VARIANT: HomeVariant = 'career-loop';

/** Where an unrecognised value lands. Documented, not incidental. */
export const FALLBACK_HOME_VARIANT: HomeVariant = 'film';

export function isHomeVariant(value: unknown): value is HomeVariant {
  return typeof value === 'string' && (HOME_VARIANTS as readonly string[]).includes(value);
}

/**
 * @param raw normally `process.env.PUBLIC_HOME_VARIANT`
 */
export function resolveHomeVariant(raw: string | undefined | null): HomeVariant {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value) return DEFAULT_HOME_VARIANT;
  if (isHomeVariant(value)) return value;
  return FALLBACK_HOME_VARIANT;
}
