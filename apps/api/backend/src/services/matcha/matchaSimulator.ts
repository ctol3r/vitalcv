// apps/api/backend/src/services/matcha/matchaSimulator.ts
//
// MATCHA Opportunity Simulator — deterministic "what if" impact analysis.
//
// Answers "if you earned credential X, how many more live roles would become
// cleared to apply?" by RE-RUNNING the pure matching engine
// (`matchOpportunities`) with X added to a LOCAL COPY of the clinician's
// evidence, then diffing against the real baseline. It never estimates and
// never invents: every number is the engine's own recomputed output over the
// clinician's real opportunity set. The credentials it offers are derived from
// what actually blocks the clinician's real roles (`missingCredentials`), so it
// only ever suggests moves that genuinely matter.
//
// Honesty properties:
//   • Never mutates the clinician's real credentials/evidence (local spread only).
//   • Only surfaces positive-impact moves (no zero/negative theatre).
//   • CONSERVATIVE by construction: a hypothetical credential carries no state
//     or specialty scope, so a state-/specialty-scoped requirement (e.g. a
//     specific state license, a specialty board cert) is only counted as
//     satisfied when the engine does not require a matching scope. This can
//     UNDER-count impact but can never OVER-count it — the truth-contract-safe
//     direction. The high-signal, unambiguous moves (ACLS, BLS, ATLS, DEA, CDS,
//     malpractice, privileges, work auth) simulate exactly.

import { matchOpportunities } from './matchaEngine';
import type {
  ClinicianProfile,
  CredentialKey,
  HeldCredential,
  MatchBand,
  Opportunity,
  OpportunityMatch,
} from './matchaModels';

const CLEARED_BANDS: ReadonlySet<MatchBand> = new Set<MatchBand>(['CLEAR', 'NEAR_CLEAR']);

/** Human labels for credential keys. */
const CREDENTIAL_LABELS: Record<CredentialKey, string> = {
  state_license: 'State License',
  board_cert: 'Board Certification',
  dea: 'DEA Registration',
  npi: 'NPI',
  malpractice: 'Malpractice Coverage',
  sanctions_clear: 'Sanctions Clearance',
  work_auth: 'Work Authorization',
  cds: 'CDS Registration',
  hospital_privileges: 'Hospital Privileges',
  bls: 'BLS',
  acls: 'ACLS',
  atls: 'ATLS',
};

/**
 * Identity/registry facts that are not clinician-"earnable" certifications —
 * we never suggest "earn" these even if an opportunity lists them.
 */
const NON_EARNABLE: ReadonlySet<CredentialKey> = new Set<CredentialKey>([
  'npi',
  'sanctions_clear',
]);

export interface CredentialScenario {
  /** Stable id, e.g. 'earn:acls'. */
  id: string;
  credentialKey: CredentialKey;
  /** e.g. 'Earn ACLS'. */
  label: string;
  /** Net new roles that become cleared to apply if this credential is earned. */
  jobsUnlocked: number;
  /** Cleared-to-apply count after the change. */
  clearedAfter: number;
  /** Average engine score change across all roles (whole number). */
  avgScoreDelta: number;
  /** Provenance line — what was actually recomputed. */
  basis: string;
}

export interface SimulationResult {
  totalOpportunities: number;
  baselineCleared: number;
  /** Positive-impact moves only, sorted by impact. */
  scenarios: CredentialScenario[];
  generatedAt: string;
}

function clearedIds(matches: OpportunityMatch[]): Set<string> {
  const ids = new Set<string>();
  for (const m of matches) {
    if (CLEARED_BANDS.has(m.explanation.matchBand)) ids.add(m.opportunity.id);
  }
  return ids;
}

function avgScore(matches: OpportunityMatch[]): number {
  if (matches.length === 0) return 0;
  return matches.reduce((sum, m) => sum + m.explanation.matchScore, 0) / matches.length;
}

function heldActiveKeys(profile: ClinicianProfile): Set<CredentialKey> {
  const keys = new Set<CredentialKey>();
  for (const c of profile.credentials) {
    if (c.status === 'active' || c.status === 'expiring') keys.add(c.key);
  }
  return keys;
}

/**
 * Deterministically simulate the impact of earning each credential that
 * currently blocks one or more of the clinician's real live opportunities.
 * Pure: no I/O, no mutation of `profile`.
 */
export function simulateCredentialImpact(
  profile: ClinicianProfile,
  opportunities: Opportunity[],
  generatedAt: string,
): SimulationResult {
  const active = opportunities.filter((o) => o.active);
  const baseline = matchOpportunities(profile, null, active);
  const baseCleared = clearedIds(baseline);
  const baseAvg = avgScore(baseline);
  const held = heldActiveKeys(profile);

  // Candidate credentials = what actually blocks real roles, that the clinician
  // does not already hold, minus non-earnable identity facts.
  const candidates = new Set<CredentialKey>();
  for (const m of baseline) {
    for (const key of m.explanation.missingCredentials) {
      if (!held.has(key) && !NON_EARNABLE.has(key)) candidates.add(key);
    }
  }

  const scenarios: CredentialScenario[] = [];
  for (const key of candidates) {
    const hypothetical: HeldCredential = {
      key,
      status: 'active',
      claimLevel: 'L3',
      issuer: 'simulated',
    };
    const simProfile: ClinicianProfile = {
      ...profile,
      credentials: [...profile.credentials, hypothetical],
    };
    const simMatches = matchOpportunities(simProfile, null, active);
    const simCleared = clearedIds(simMatches);

    let jobsUnlocked = 0;
    for (const id of simCleared) {
      if (!baseCleared.has(id)) jobsUnlocked += 1;
    }
    const avgScoreDelta = Math.round(avgScore(simMatches) - baseAvg);

    // Only surface moves that genuinely help.
    if (jobsUnlocked <= 0 && avgScoreDelta <= 0) continue;

    const label = CREDENTIAL_LABELS[key];
    scenarios.push({
      id: `earn:${key}`,
      credentialKey: key,
      label: `Earn ${label}`,
      jobsUnlocked,
      clearedAfter: simCleared.size,
      avgScoreDelta,
      basis: `Re-scored ${active.length} live role${active.length === 1 ? '' : 's'} with ${label} added to your evidence`,
    });
  }

  scenarios.sort(
    (a, b) => b.jobsUnlocked - a.jobsUnlocked || b.avgScoreDelta - a.avgScoreDelta,
  );

  return {
    totalOpportunities: active.length,
    baselineCleared: baseCleared.size,
    scenarios,
    generatedAt,
  };
}
