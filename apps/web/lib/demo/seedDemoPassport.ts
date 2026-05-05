/**
 * seedDemoPassport.ts
 *
 * Idempotent request-time seeder for the demo passport.
 *
 * The seeder is pure — it returns the fixture object when the id (NPI
 * or entityId) matches DEMO_NPI, otherwise null. No DB writes, no
 * fetches, no caching layer (the fixture is a frozen module-scope
 * constant; calling getDemoPassport() repeatedly is free).
 */
import { DEMO_NPI } from '@/lib/env';
import { MACIE_MILLER_DEMO_PASSPORT } from './demoPassportFixture';
import type { PassportData } from '@/lib/trust/passport-contract';

export interface DemoPassportLookup {
  passport: PassportData;
  isDemo: true;
}

/**
 * Returns the demo passport when `id` matches DEMO_NPI, otherwise null.
 *
 * Accepts either a raw NPI ('1346053246') or the demo entityId
 * ('demo-entity-macie-miller') so both `/passport/<NPI>` and
 * `/passport/<entityId>` URLs hydrate from the fixture.
 */
export function getDemoPassport(id: string | null | undefined): DemoPassportLookup | null {
  if (typeof id !== 'string') return null;
  const trimmed = id.trim();
  if (trimmed.length === 0) return null;
  if (trimmed === DEMO_NPI || trimmed === MACIE_MILLER_DEMO_PASSPORT.entityId) {
    return { passport: MACIE_MILLER_DEMO_PASSPORT, isDemo: true };
  }
  return null;
}
