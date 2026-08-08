/**
 * Is this process serving CANONICAL PRODUCTION — the deployment the public
 * reaches at vitalcv.com?
 *
 * This one predicate had grown three copies of the same two-line rule
 * (`lib/design/preview.ts`, `components/matcha-deck/sourceBoundary.ts`, and it
 * was about to gain a third in `app/robots.ts`). Three copies of a boundary is
 * how a boundary drifts: the review environment landed and only two of them
 * would have learned about it. Both existing callers now import from here.
 *
 * What counts as canonical production is the DEPLOYMENT's own claim about
 * itself — `RAILWAY_ENVIRONMENT` on Railway, `VERCEL_ENV` on the deprecated
 * Vercel path — never a hostname and never `NODE_ENV`. A review environment
 * runs the identical production build (`NODE_ENV=production`) against the same
 * domain family, so `NODE_ENV` cannot tell them apart, and a hostname check
 * would be defeated the moment a custom domain is added.
 *
 * The consequence to hold on to: **everything that is not canonical production
 * must be treated as a place the public should not find.** Review deployments
 * serve a blanket robots disallow and a `noindex` header for exactly this
 * reason — a second, crawlable copy of the marketing site is an SEO hazard
 * that no test would have caught.
 */

export interface DeploymentEnvironment {
  RAILWAY_ENVIRONMENT?: string;
  VERCEL_ENV?: string;
}

/**
 * The pure predicate — takes an environment shape, so every caller's own
 * `*PreviewEnvironment` interface satisfies it and the rule stays testable
 * without touching `process.env`.
 */
export function isCanonicalProduction(env: DeploymentEnvironment): boolean {
  return (
    env.RAILWAY_ENVIRONMENT?.trim().toLowerCase() === 'production'
    || env.VERCEL_ENV?.trim().toLowerCase() === 'production'
  );
}

/**
 * The same question about THIS process.
 *
 * Exists because `process.env` cannot be passed to the predicate directly:
 * `NodeJS.ProcessEnv` and an all-optional interface share no required members,
 * so TypeScript's weak-type detection rejects the call. Adding an index
 * signature to `DeploymentEnvironment` would fix that and then demand one from
 * every caller's interface in turn — the fix spreads. Reading the two fields
 * here keeps the contagion contained to one function.
 */
export function isCanonicalProductionProcess(): boolean {
  return isCanonicalProduction({
    RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
}
