/**
 * FOUNDATION-SWEEP-1 — clinician profile foundation tests.
 *
 * Truth invariants this suite enforces:
 *   - User-entered fields are NEVER counted as verified.
 *   - Missing provenance / unknown fields lower readiness.
 *   - Education / training / employer / affiliation fields require
 *     provenance metadata (the type system enforces it; this suite
 *     proves the helpers respect it at runtime).
 *   - PubMed entries are imported-candidates until source-backed.
 *   - Unknown / conflict fields do not count as verified completion.
 *   - Import page does not claim live integration.
 *   - Graph preview page declares that the graph does not verify by itself.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  isCoherentProvenance,
  type ClinicianProfile,
  type ProfileFieldConfidence,
  type ProfileFieldMeta,
  type ProfileFieldProvenance,
} from '../lib/clinician-profile/profileTypes';
import {
  calculateClinicianProfileCompletion,
  explainProfileFieldProvenance,
  getMissingProfileFoundationFields,
  getProfileSectionReadiness,
} from '../lib/clinician-profile/profileCompletion';

function f<T>(
  value: T | null,
  provenance: ProfileFieldProvenance,
  confidence: ProfileFieldConfidence = 'self-attested',
): ProfileFieldMeta<T | null> {
  return { value, provenance, confidence };
}

function emptyProfile(): ClinicianProfile {
  return {
    clinicianId: 'cl-test',
    identity: {
      legalName: f<string>(null, 'UNKNOWN', 'unverified'),
      preferredName: f<string>(null, 'UNKNOWN', 'unverified'),
      npi: f<string>(null, 'UNKNOWN', 'unverified'),
      primaryEmail: f<string>(null, 'UNKNOWN', 'unverified'),
      primaryPhone: f<string>(null, 'UNKNOWN', 'unverified'),
      practiceLocations: f<string[]>(null, 'UNKNOWN', 'unverified'),
    },
    education: [],
    training: [],
    specialties: [],
    currentEmployer: null,
    employerHistory: [],
    affiliations: [],
    research: [],
    publications: [],
    careerGoals: f<string>(null, 'UNKNOWN', 'unverified'),
  };
}

describe('clinician profile foundation — coherence rules', () => {
  it('rejects USER_ENTERED + source-backed combination', () => {
    expect(isCoherentProvenance('USER_ENTERED', 'source-backed')).toBe(false);
  });

  it('allows USER_ENTERED + self-attested', () => {
    expect(isCoherentProvenance('USER_ENTERED', 'self-attested')).toBe(true);
  });

  it('forces UNKNOWN to be unverified', () => {
    expect(isCoherentProvenance('UNKNOWN', 'unverified')).toBe(true);
    expect(isCoherentProvenance('UNKNOWN', 'self-attested')).toBe(false);
    expect(isCoherentProvenance('UNKNOWN', 'source-backed')).toBe(false);
  });

  it('rejects CONFLICT + source-backed', () => {
    expect(isCoherentProvenance('CONFLICT', 'source-backed')).toBe(false);
  });
});

describe('clinician profile foundation — completion math', () => {
  it('an empty profile reads zero on every overall axis', () => {
    const summary = calculateClinicianProfileCompletion(emptyProfile());
    expect(summary.overallFilledRatio).toBe(0);
    expect(summary.overallSourceBackedRatio).toBe(0);
    expect(summary.overallVerificationReadiness).toBe(0);
  });

  it('user-entered fields fill the profile but do not count as verified', () => {
    const profile = emptyProfile();
    profile.identity.legalName = f('Sample Clinician', 'USER_ENTERED', 'self-attested');
    profile.identity.primaryEmail = f('s@example.org', 'USER_ENTERED', 'self-attested');
    const summary = calculateClinicianProfileCompletion(profile);
    expect(summary.overallFilledRatio).toBeGreaterThan(0);
    expect(summary.overallSourceBackedRatio).toBe(0);
    expect(summary.overallNote).toContain('count as verified');
  });

  it('source-backed identity contributes more readiness than self-attested', () => {
    const selfAttested = emptyProfile();
    selfAttested.identity.npi = f('1234567890', 'USER_ENTERED', 'self-attested');
    const sourceBacked = emptyProfile();
    sourceBacked.identity.npi = f('1234567890', 'VERIFIED', 'source-backed');
    const a = calculateClinicianProfileCompletion(selfAttested).overallVerificationReadiness;
    const b = calculateClinicianProfileCompletion(sourceBacked).overallVerificationReadiness;
    expect(b).toBeGreaterThan(a);
  });

  it('unknown and conflict fields do not count as verified completion', () => {
    const profile = emptyProfile();
    profile.identity.legalName = f('Has Conflict', 'CONFLICT', 'unverified');
    const summary = calculateClinicianProfileCompletion(profile);
    expect(summary.overallSourceBackedRatio).toBe(0);
    const identitySig = summary.sections.find((s) => s.section === 'identity');
    expect(identitySig?.unresolvedConflictCount).toBeGreaterThan(0);
    expect(identitySig?.readinessNote).toContain('conflict');
  });

  it('education entries require provenance metadata for medical-school readiness to count', () => {
    const profile = emptyProfile();
    profile.education.push({
      id: 'edu-1',
      institution: f('Sample School', 'USER_ENTERED', 'self-attested'),
      degree: f('MD', 'USER_ENTERED', 'self-attested'),
      graduationYear: f<number>(2012, 'USER_ENTERED', 'self-attested'),
      programType: 'medical_school',
    });
    const sig = getProfileSectionReadiness(profile, 'medical_school');
    expect(sig).not.toBeNull();
    expect(sig!.filledFieldCount).toBe(3);
    expect(sig!.sourceBackedFieldCount).toBe(0);
    expect(sig!.readinessNote).toContain('not been attached');
  });

  it('residency / fellowship / training are tracked separately', () => {
    const profile = emptyProfile();
    profile.training.push({
      id: 't-1',
      programType: 'residency',
      institution: f('Sample Hosp', 'USER_ENTERED', 'self-attested'),
      specialty: f('Internal Medicine', 'USER_ENTERED', 'self-attested'),
      startYear: f<number>(2012, 'USER_ENTERED', 'self-attested'),
      endYear: f<number>(2015, 'USER_ENTERED', 'self-attested'),
    });
    profile.training.push({
      id: 't-2',
      programType: 'fellowship',
      institution: f('Sample Hosp', 'USER_ENTERED', 'self-attested'),
      specialty: f('Cardiology', 'USER_ENTERED', 'self-attested'),
      startYear: f<number>(2015, 'USER_ENTERED', 'self-attested'),
      endYear: f<number>(2018, 'USER_ENTERED', 'self-attested'),
    });
    const summary = calculateClinicianProfileCompletion(profile);
    const residency = summary.sections.find((s) => s.section === 'residency');
    const fellowship = summary.sections.find((s) => s.section === 'fellowship');
    expect(residency?.filledFieldCount).toBe(4);
    expect(fellowship?.filledFieldCount).toBe(4);
  });

  it('current employer and affiliations require provenance', () => {
    const profile = emptyProfile();
    profile.currentEmployer = {
      id: 'e-1',
      employer: f('Sample Health', 'USER_ENTERED', 'self-attested'),
      title: f('Attending', 'USER_ENTERED', 'self-attested'),
      startDate: f('2018-01-01', 'USER_ENTERED', 'self-attested'),
      endDate: f<string>(null, 'UNKNOWN', 'unverified'),
      isCurrent: true,
    };
    profile.affiliations.push({
      id: 'a-1',
      organization: f('Sample Hospital', 'USER_ENTERED', 'self-attested'),
      affiliationType: f('Privileges', 'USER_ENTERED', 'self-attested'),
      startDate: f('2018-01-01', 'USER_ENTERED', 'self-attested'),
      endDate: f<string>(null, 'UNKNOWN', 'unverified'),
    });
    const employerSig = getProfileSectionReadiness(profile, 'current_employer');
    const affiliationSig = getProfileSectionReadiness(profile, 'affiliations');
    expect(employerSig?.sourceBackedFieldCount).toBe(0);
    expect(affiliationSig?.sourceBackedFieldCount).toBe(0);
  });

  it('PubMed publication entry stays imported-candidate until source-backed', () => {
    const profile = emptyProfile();
    profile.publications.push({
      id: 'p-1',
      title: f('Sample Title', 'INFERRED', 'imported-candidate'),
      journal: f('Sample Journal', 'INFERRED', 'imported-candidate'),
      publishedYear: f<number>(2024, 'INFERRED', 'imported-candidate'),
      pubmedId: f('00000000', 'INFERRED', 'imported-candidate'),
      importSource: 'pubmed',
    });
    const sig = getProfileSectionReadiness(profile, 'publications');
    expect(sig?.filledFieldCount).toBe(4);
    expect(sig?.sourceBackedFieldCount).toBe(0);
    expect(sig?.readinessNote.toLowerCase()).toContain('source-backed');
  });

  it('missing-foundation getter highlights sections with no source-backed evidence', () => {
    const profile = emptyProfile();
    profile.identity.legalName = f('Sample', 'USER_ENTERED', 'self-attested');
    const missing = getMissingProfileFoundationFields(profile);
    expect(missing).toContain('identity');
  });

  it('explainProfileFieldProvenance returns vocabulary descriptions', () => {
    expect(explainProfileFieldProvenance('VERIFIED')).toMatch(/source/i);
    expect(explainProfileFieldProvenance('USER_ENTERED')).toMatch(/clinician/i);
    expect(explainProfileFieldProvenance('UNKNOWN')).toMatch(/no data/i);
  });
});

const APP_DIR = resolve(__dirname, '..', 'app');
const ROUTE_DIR = resolve(APP_DIR, 'clinician');

function readRoute(rel: string): string {
  return readFileSync(resolve(ROUTE_DIR, rel), 'utf-8');
}

function readAppRoute(rel: string): string {
  return readFileSync(resolve(APP_DIR, rel), 'utf-8');
}

describe('clinician foundation — route copy invariants', () => {
  it('canonical onboarding keeps self-attestation separate from verification', () => {
    // The /clinician/onboarding redirect alias was retired 2026-08-07
    // (headerless-routes disposition, bucket D); the attestation pins live
    // on the canonical surface.
    const src = readAppRoute('get-ready/GetReadySurface.tsx');
    expect(src).toContain('You&apos;re attesting to your role');
    expect(src).toContain('VitalCV records this attestation; it does not verify it here.');
  });

  it('onboarding page does not claim government ID / liveness is live', () => {
    const src = readAppRoute('get-ready/GetReadySurface.tsx');
    expect(src.toLowerCase()).not.toContain('government id verified');
    expect(src.toLowerCase()).not.toContain('liveness verified');
    expect(src).toContain('Government ID, liveness, and license verification are separate');
  });

  it('the no-NPI preview lane is honestly labelled preview / self-attested', () => {
    const src = readAppRoute('get-ready/GetReadySurface.tsx');
    // The lane exists and posts to the preview-only bootstrap.
    expect(src).toContain('/api/profile/student/bootstrap');
    expect(src).toContain('health-professions student');
    // Honest labelling: preview, self-attested, not source-verified, not decision-grade.
    expect(src).toContain('self-attested and not source-verified');
    expect(src.toLowerCase()).toContain('not decision-grade');
    // Reuses the attestation-is-not-verification pin.
    expect(src).toContain('VitalCV records this attestation; it does not verify it here.');
  });

  it('profile page renders provenance vocabulary disclaimer', () => {
    // Scans the route's whole composition, not just page.tsx. The disclaimer
    // and the provenance vocabulary used to live literally in page.tsx, back
    // when it was a self-contained read-only shell; the page now delegates to
    // ProfileSurface and the same strings render from there.
    //
    // Grepping page.tsx alone asserted the MECHANISM (which file holds the
    // string) rather than the INVARIANT (the route shows the disclaimer and
    // speaks provenance). That form of guard fails on a refactor that changes
    // nothing a clinician sees — and, worse, would pass if page.tsx kept the
    // string in a comment while rendering nothing. Rendered-DOM coverage of
    // both strings lives in clinician-profile-licensure.test.tsx.
    const composition = [readRoute('profile/page.tsx'), readRoute('profile/ProfileSurface.tsx')].join('\n');
    expect(composition).toContain(
      'User-entered information is not verified until source-backed evidence is attached.',
    );
    expect(composition).toContain('PROVENANCE_META');
  });

  // The import-page and graph-page blocks left with their routes: the
  // 2026-08-07 retirement deleted /clinician/import (spec shell) and
  // /clinician/graph (the SHD-0.3 quarantine redirect — quarantine complete,
  // the alias itself is now gone). /clinician/profile remains live and
  // remains pinned above and below.

  it('no clinician foundation page contains forbidden truth-contract phrases', () => {
    const banned = [
      'guaranteed verification',
      'instant credentialing',
      'complete credentialing',
      'legally accepted',
      'risk transferred',
      'HIPAA compliant',
      'SOC2 certified',
      'NCQA verified',
      'irreversible proof',
      'global credential truth',
      'tamper-proof',
    ];
    for (const rel of ['profile/page.tsx']) {
      const src = readRoute(rel).toLowerCase();
      for (const phrase of banned) {
        expect(src).not.toContain(phrase.toLowerCase());
      }
    }
  });
});
