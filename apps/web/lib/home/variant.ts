/**
 * Which homepage `/` serves — Wave 1075, amended by UX-V1.
 *
 * UX-V1 (the production experience cutover) replaces the career loop at the
 * root. Neither predecessor is deleted: `career-loop` and `film` stay as
 * tested, one-env-var rollbacks so an incident is contained by a redeploy
 * rather than by writing code under pressure.
 *
 * Resolved on the SERVER, once, before render. There is no client-side switch
 * and therefore no flash between variants, and the HTML a crawler receives is
 * the HTML a visitor receives.
 *
 * Unknown or absent values fall back to `film` — the longest-serving variant.
 * A typo in an env var must not decide what the homepage is; it should leave
 * it somewhere known-good and be visible in the logs.
 */

export const HOME_VARIANTS = ['easy', 'career-loop', 'film'] as const;
export type HomeVariant = (typeof HOME_VARIANTS)[number];

/** What ships when nothing is configured. */
export const DEFAULT_HOME_VARIANT: HomeVariant = 'easy';

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
