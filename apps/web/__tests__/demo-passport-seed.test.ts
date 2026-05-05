/**
 * demo-passport-seed.test.ts
 *
 * Verifies the seeded demo passport for /passport/[DEMO_NPI].
 * Closes the Browser-QA "20 of 28 boundaries not testable" finding.
 *
 * Truth contracts:
 *   1. getDemoPassport(DEMO_NPI) returns the fixture; getDemoPassport(other) returns null
 *   2. Fixture passes assertPassportData() — every panel mounts without throwing
 *   3. Every audit-metadata field carries recordedBy: 'demo'
 *   4. Sample PSV receipt has globalCredentialTruth: false (literal)
 *   5. Banner copy matches the page render path AND fixture contains no real PHI
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEMO_NPI, isDemoNpi } from '../lib/env';
import { getDemoPassport } from '../lib/demo/seedDemoPassport';
import {
  MACIE_MILLER_DEMO_PASSPORT,
  MACIE_MILLER_LANE_SNAPSHOTS,
  MACIE_MILLER_PSV_RECEIPT_SAMPLE,
  DEMO_PASSPORT_BANNER_COPY,
} from '../lib/demo/demoPassportFixture';
import { assertPassportData } from '../lib/trust/passport-contract';

describe('demo passport seed', () => {
  it('case 1: getDemoPassport returns the fixture for DEMO_NPI and null otherwise', () => {
    expect(DEMO_NPI).toBe('1346053246');
    expect(isDemoNpi('1346053246')).toBe(true);
    expect(isDemoNpi('1003000126')).toBe(false);
    expect(isDemoNpi(null)).toBe(false);

    const hit = getDemoPassport('1346053246');
    expect(hit).not.toBeNull();
    expect(hit!.isDemo).toBe(true);
    expect(hit!.passport.npi).toBe('1346053246');

    expect(getDemoPassport('1003000126')).toBeNull();
    expect(getDemoPassport('')).toBeNull();
    expect(getDemoPassport(null)).toBeNull();

    // Also resolves by entityId so /passport/<entityId> works
    expect(getDemoPassport(MACIE_MILLER_DEMO_PASSPORT.entityId)).not.toBeNull();
  });

  it('case 2: fixture passes assertPassportData — every panel can mount without throwing', () => {
    expect(() => assertPassportData(MACIE_MILLER_DEMO_PASSPORT, 'demo passport')).not.toThrow();

    // All 4 lane states populated so LaneHealthMount renders every branch
    const states = MACIE_MILLER_LANE_SNAPSHOTS.map((s) => s.state).sort();
    expect(states).toEqual(['limitation_required', 'missing_evidence', 'ready_for_review', 'verified']);
  });

  it('case 3: every audit-metadata field carries recordedBy: demo (no production attribution leaks)', () => {
    for (const lane of MACIE_MILLER_LANE_SNAPSHOTS) {
      expect(lane.recordedBy).toBe('demo');
    }
    expect(MACIE_MILLER_PSV_RECEIPT_SAMPLE.recordedBy).toBe('demo');
  });

  it('case 4: sample PSV receipt carries globalCredentialTruth: false literal', () => {
    expect(MACIE_MILLER_PSV_RECEIPT_SAMPLE.globalCredentialTruth).toBe(false);
    // Type-level: would not compile if widened from `false` to `boolean`
    const literalCheck: false = MACIE_MILLER_PSV_RECEIPT_SAMPLE.globalCredentialTruth;
    expect(literalCheck).toBe(false);
    expect(MACIE_MILLER_PSV_RECEIPT_SAMPLE.proofTier).toBe('psv_receipt');
  });

  it('case 5: banner copy matches page render path AND fixture contains no real PHI/NPI from production data', () => {
    // Banner constant matches what the page passes to the client component
    const pagePath = resolve(__dirname, '../app/passport/[id]/page.tsx');
    const pageSource = readFileSync(pagePath, 'utf-8');
    expect(pageSource).toContain('DEMO_PASSPORT_BANNER_COPY');
    expect(DEMO_PASSPORT_BANNER_COPY).toContain('synthetic data');
    expect(DEMO_PASSPORT_BANNER_COPY).toContain('not a real clinician record');

    // Page must invoke getDemoPassport on the route id
    expect(pageSource).toContain('getDemoPassport(id)');
    // Client component must render the banner via demo prop pass-through
    const clientPath = resolve(__dirname, '../app/passport/[id]/PassportEntityClient.tsx');
    const clientSource = readFileSync(clientPath, 'utf-8');
    expect(clientSource).toContain('demoBanner');
    expect(clientSource).toContain('data-testid="demo-passport-banner"');

    // Synthetic data marker: institution name is explicitly tagged synthetic
    expect(MACIE_MILLER_DEMO_PASSPORT.training.records[0].institutionName).toContain('synthetic demo institution');

    // No real production PHI markers — the only NPI in the fixture is the
    // demo NPI itself; no real names, no real DEA, no real email
    const fixtureJson = JSON.stringify(MACIE_MILLER_DEMO_PASSPORT);
    // Sweep for credential numbers that look like real DEA registrations (BB#######)
    expect(fixtureJson).not.toMatch(/\b[A-Z]{2}\d{7}\b/);
    // No SSN-like patterns
    expect(fixtureJson).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/);
    // No NPIs other than the demo one
    const npiMatches = fixtureJson.match(/\b\d{10}\b/g) ?? [];
    for (const npi of npiMatches) {
      expect(npi).toBe(DEMO_NPI);
    }
  });
});
