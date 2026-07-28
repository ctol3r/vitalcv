/**
 * Gate for the /dev/career-garden harness — same semantics as the MATCHA deck
 * preview boundary: open in local dev, explicit opt-in for production-mode
 * test builds, always denied on canonical production.
 */
export interface CareerGardenPreviewEnvironment {
  NODE_ENV?: string;
  CAREER_GARDEN_PREVIEW?: string;
  RAILWAY_ENVIRONMENT?: string;
  VERCEL_ENV?: string;
}

export function isCareerGardenPreviewAllowed(env: CareerGardenPreviewEnvironment): boolean {
  if (env.NODE_ENV !== 'production') return true;

  const isCanonicalProduction =
    env.RAILWAY_ENVIRONMENT?.trim().toLowerCase() === 'production'
    || env.VERCEL_ENV?.trim().toLowerCase() === 'production';

  return env.CAREER_GARDEN_PREVIEW === '1' && !isCanonicalProduction;
}
