/**
 * Gate for the /dev/career-garden harness — same semantics as the MATCHA deck
 * preview boundary: open in local dev, explicit opt-in for production-mode
 * test builds, always denied on canonical production.
 */
import { isCanonicalProduction } from '@/lib/deployment/canonicalProduction';

export interface CareerGardenPreviewEnvironment {
  NODE_ENV?: string;
  CAREER_GARDEN_PREVIEW?: string;
  RAILWAY_ENVIRONMENT?: string;
  VERCEL_ENV?: string;
}

export function isCareerGardenPreviewAllowed(env: CareerGardenPreviewEnvironment): boolean {
  if (env.NODE_ENV !== 'production') return true;

  return env.CAREER_GARDEN_PREVIEW === '1' && !isCanonicalProduction(env);
}
