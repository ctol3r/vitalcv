/**
 * MATCHA Opportunity Simulator — deterministic-truth unit tests.
 *
 * These pin the honesty invariants rather than brittle exact scores:
 *   • adding a credential never REDUCES the cleared-to-apply set (monotonic),
 *   • unblocking a hard-required credential yields a positive-impact scenario,
 *   • non-earnable identity facts (npi, sanctions_clear) are never suggested,
 *   • the clinician's real credentials are never mutated,
 *   • no opportunities → no scenarios, and a fully-credentialed clinician has
 *     nothing to "unlock".
 */
import {
  simulateCredentialImpact,
} from '../matchaSimulator';
import type {
  ClinicianProfile,
  CredentialKey,
  HeldCredential,
  Opportunity,
  RequirementSpec,
} from '../matchaModels';

const NOW = '2026-07-04T00:00:00.000Z';

function cred(key: CredentialKey, over: Partial<HeldCredential> = {}): HeldCredential {
  return { key, status: 'active', claimLevel: 'L3', issuer: 'test', ...over };
}

function req(key: CredentialKey, over: Partial<RequirementSpec> = {}): RequirementSpec {
  return { key, label: key, level: 'L3', priority: 'required', ...over };
}

function makeOpp(id: string, requirements: RequirementSpec[], over: Partial<Opportunity> = {}): Opportunity {
  return {
    id,
    title: `Role ${id}`,
    employerSlug: 'acme',
    facility: 'Acme Medical',
    location: 'Oakland, CA',
    state: 'CA',
    specialty: 'Emergency',
    hiringType: 'perm',
    employerType: 'hospital',
    startUrgency: 'flexible',
    remote: false,
    requirements,
    urgency: 'within_30_days',
    minimumTrustBand: 'L2',
    credentialRequirements: [],
    postedAt: NOW,
    active: true,
    ...over,
  };
}

function makeClinician(credentials: HeldCredential[], over: Partial<ClinicianProfile> = {}): ClinicianProfile {
  return {
    npi: '1234567890',
    name: 'Test Clinician',
    specialty: 'Emergency',
    states: ['CA'],
    credentials,
    ...over,
  };
}

describe('simulateCredentialImpact', () => {
  it('surfaces a positive-impact scenario for a hard-required credential the clinician lacks', () => {
    const clinician = makeClinician([
      cred('npi'),
      cred('state_license', { claimLevel: 'L2', state: 'CA' }),
    ]);
    const opp = makeOpp('a', [
      req('state_license', { level: 'L2', state: 'CA' }),
      req('acls', { level: 'L3' }),
    ]);

    const result = simulateCredentialImpact(clinician, [opp], NOW);
    const acls = result.scenarios.find((s) => s.credentialKey === 'acls');

    expect(acls).toBeDefined();
    expect(acls!.id).toBe('earn:acls');
    expect(acls!.label).toBe('Earn ACLS');
    // Unblocking a hard requirement can only raise the engine's score.
    expect(acls!.avgScoreDelta).toBeGreaterThan(0);
    expect(acls!.basis).toContain('Re-scored 1 live role');
  });

  it('never REDUCES the cleared set — clearedAfter is monotonic vs baseline', () => {
    const clinician = makeClinician([cred('npi'), cred('state_license', { claimLevel: 'L2', state: 'CA' })]);
    const opps = [
      makeOpp('a', [req('acls', { level: 'L3' })]),
      makeOpp('b', [req('atls', { level: 'L3' })]),
    ];
    const result = simulateCredentialImpact(clinician, opps, NOW);
    for (const s of result.scenarios) {
      expect(s.clearedAfter).toBeGreaterThanOrEqual(result.baselineCleared);
      expect(s.jobsUnlocked).toBeGreaterThanOrEqual(0);
    }
  });

  it('never suggests non-earnable identity facts (npi, sanctions_clear)', () => {
    // Clinician lacks both sanctions_clear (non-earnable) and acls (earnable).
    const clinician = makeClinician([
      cred('npi'),
      cred('state_license', { claimLevel: 'L2', state: 'CA' }),
    ]);
    const opps = [
      // Blocked only by a NON-earnable identity fact → must never be suggested.
      makeOpp('a', [req('state_license', { level: 'L2', state: 'CA' }), req('sanctions_clear', { level: 'L2' })]),
      // Blocked only by an EARNABLE certification → should surface.
      makeOpp('b', [req('state_license', { level: 'L2', state: 'CA' }), req('acls', { level: 'L3' })]),
    ];
    const result = simulateCredentialImpact(clinician, opps, NOW);

    const keys = result.scenarios.map((s) => s.credentialKey);
    expect(keys).not.toContain('sanctions_clear');
    expect(keys).not.toContain('npi');
    // ACLS (earnable) still surfaces.
    expect(keys).toContain('acls');
  });

  it('does not mutate the clinician real credentials (pure)', () => {
    const clinician = makeClinician([cred('npi'), cred('state_license', { claimLevel: 'L2', state: 'CA' })]);
    const before = clinician.credentials.length;
    const beforeKeys = clinician.credentials.map((c) => c.key).join(',');

    simulateCredentialImpact(clinician, [makeOpp('a', [req('acls', { level: 'L3' })])], NOW);

    expect(clinician.credentials.length).toBe(before);
    expect(clinician.credentials.map((c) => c.key).join(',')).toBe(beforeKeys);
  });

  it('returns no scenarios when there are no opportunities', () => {
    const result = simulateCredentialImpact(makeClinician([cred('npi')]), [], NOW);
    expect(result.scenarios).toEqual([]);
    expect(result.totalOpportunities).toBe(0);
    expect(result.baselineCleared).toBe(0);
  });

  it('offers nothing to unlock when the clinician already holds every required credential', () => {
    const clinician = makeClinician([
      cred('npi'),
      cred('state_license', { claimLevel: 'L2', state: 'CA' }),
      cred('acls'),
    ]);
    const opp = makeOpp('a', [
      req('state_license', { level: 'L2', state: 'CA' }),
      req('acls', { level: 'L3' }),
    ]);
    const result = simulateCredentialImpact(clinician, [opp], NOW);
    expect(result.scenarios).toEqual([]);
  });

  it('sorts scenarios by impact (jobsUnlocked desc, then avgScoreDelta desc)', () => {
    const clinician = makeClinician([cred('npi'), cred('state_license', { claimLevel: 'L2', state: 'CA' })]);
    // Two roles each blocked only by a different missing credential.
    const opps = [
      makeOpp('a', [req('acls', { level: 'L3' })]),
      makeOpp('b', [req('acls', { level: 'L3' })]),
      makeOpp('c', [req('atls', { level: 'L3' })]),
    ];
    const result = simulateCredentialImpact(clinician, opps, NOW);
    for (let i = 1; i < result.scenarios.length; i += 1) {
      const prev = result.scenarios[i - 1];
      const curr = result.scenarios[i];
      const prevRank = prev.jobsUnlocked * 1000 + prev.avgScoreDelta;
      const currRank = curr.jobsUnlocked * 1000 + curr.avgScoreDelta;
      expect(prevRank).toBeGreaterThanOrEqual(currRank);
    }
  });
});
