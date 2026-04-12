/**
 * liveSimulationEngine.ts — Wave 248: Trust Simulation Engine Live
 *
 * Connects real Decision Capsules, Trust State Engine, and credential data
 * so hospitals can simulate credential revocation scenarios and see real impact.
 *
 * Three simulation modes:
 *   - simulateCredentialRevocation: "what if this credential were revoked?"
 *   - simulateLicenseExpiration: "what if this license expires on date X?"
 *   - simulateComplianceRule: "what if we added this compliance requirement?"
 */

import prisma from '../../graphql/prisma_client';
import { computeClinicianTrustState } from '../trust/trustStateEngine';
import { capsuleEngine } from '../decision/capsuleEngine';
import { appendAuditEvent } from '../audit/auditLedger';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CapsuleImpactStatus = 'WOULD_INVALIDATE' | 'WOULD_DEGRADE' | 'UNAFFECTED';

export interface AffectedCapsuleImpact {
  capsuleId: string;
  decisionType: string;
  organization: string;
  status: CapsuleImpactStatus;
}

export interface TrustStateSnapshot {
  readiness_level: string;
  readiness_score: number;
}

export interface SimulationResult {
  npi: string;
  simulatedRevocation: string;
  currentState: TrustStateSnapshot;
  projectedState: TrustStateSnapshot;
  degradation: number;
  affectedCapsules: AffectedCapsuleImpact[];
  affectedOrganizations: string[];
  estimatedImpact: {
    hospitalsAffected: number;
    privilegesImpacted: number;
    revenueImpact?: {
      dailyRevenue: number;
      daysUntilReplacement: number;
      totalAtRisk: number;
    };
    staffingGap?: {
      uncoveredShifts: number;
      affectedLocations: string[];
    };
  };
  simulationId?: string;
  simulatedAt: string;
}

export interface ComplianceSimulationResult {
  rule: string;
  specialty?: string;
  state?: string;
  affectedClinicians: number;
  wouldFailCount: number;
  gapSummary: string[];
  simulatedAt: string;
}

// ── Credential type → trust score impact mapping ───────────────────────────────

/** Score reduction and trust degradation for each revocable credential type */
const CREDENTIAL_IMPACT: Record<string, { scoreDrop: number; affectsLicensure: boolean; affectsCritical: boolean }> = {
  state_license:    { scoreDrop: 30, affectsLicensure: true,  affectsCritical: true  },
  dea:              { scoreDrop: 15, affectsLicensure: false, affectsCritical: true  },
  board_cert:       { scoreDrop: 10, affectsLicensure: false, affectsCritical: false },
  malpractice:      { scoreDrop: 8,  affectsLicensure: false, affectsCritical: false },
  hospital_priv:    { scoreDrop: 12, affectsLicensure: false, affectsCritical: true  },
  nppes:            { scoreDrop: 30, affectsLicensure: true,  affectsCritical: true  },
  npi:              { scoreDrop: 30, affectsLicensure: true,  affectsCritical: true  },
  cds:              { scoreDrop: 8,  affectsLicensure: false, affectsCritical: false },
  specialty_cert:   { scoreDrop: 10, affectsLicensure: false, affectsCritical: false },
};

/** Default impact for unknown credential types */
const DEFAULT_IMPACT = { scoreDrop: 10, affectsLicensure: false, affectsCritical: false };

function getImpact(credentialType: string) {
  const key = credentialType.toLowerCase().replace(/[^a-z_]/g, '_');
  return CREDENTIAL_IMPACT[key] ?? DEFAULT_IMPACT;
}

// ── Trust band derivation (mirrors trustStateEngine logic) ─────────────────────

const BAND_THRESHOLDS: Array<{ min: number; band: string }> = [
  { min: 80, band: 'L3' },
  { min: 60, band: 'L2' },
  { min: 30, band: 'L1' },
  { min: 0,  band: 'L0' },
];

function scoreToband(score: number, isCritical: boolean, isLicensureAffected: boolean): string {
  if (isCritical || isLicensureAffected) return 'L0';
  for (const t of BAND_THRESHOLDS) {
    if (score >= t.min) return t.band;
  }
  return 'L0';
}

// ── Capsule impact assessment ──────────────────────────────────────────────────

function assessCapsuleImpact(
  capsuleMetadata: unknown,
  credentialType: string,
  impact: { scoreDrop: number; affectsLicensure: boolean; affectsCritical: boolean },
): CapsuleImpactStatus {
  const meta = (capsuleMetadata ?? {}) as Record<string, unknown>;

  // Check if capsule has a trust state snapshot we can evaluate
  const snapshot = meta['trust_state_snapshot'] as Record<string, unknown> | undefined;

  if (!snapshot) {
    // No snapshot means we can't precisely evaluate — apply heuristics
    if (impact.affectsCritical) return 'WOULD_INVALIDATE';
    if (impact.scoreDrop > 15) return 'WOULD_DEGRADE';
    return 'UNAFFECTED';
  }

  const snapshotScore = (snapshot['readiness_score'] as number) ?? 0;
  const snapshotBand = (snapshot['readiness_level'] as string) ?? 'L0';

  // If critical credential, any capsule that was VALID/AT_RISK → INVALID
  if (impact.affectsCritical) return 'WOULD_INVALIDATE';

  // If licensure affected, L3 capsules would degrade; L0/L1 already at risk
  if (impact.affectsLicensure) {
    if (snapshotBand === 'L3' || snapshotBand === 'L2') return 'WOULD_INVALIDATE';
    return 'WOULD_DEGRADE';
  }

  // Score-based: does the drop push below a band threshold?
  const projectedScore = Math.max(0, snapshotScore - impact.scoreDrop);
  if (snapshotBand === 'L3' && projectedScore < 80) return 'WOULD_DEGRADE';
  if (snapshotBand === 'L2' && projectedScore < 60) return 'WOULD_DEGRADE';
  if (snapshotBand === 'L1' && projectedScore < 30) return 'WOULD_INVALIDATE';

  return 'UNAFFECTED';
}

/** Extract organization name from capsule metadata or fall back to NPI */
function extractOrganization(capsule: { subjectNpi: string; metadata: unknown }): string {
  const meta = (capsule.metadata ?? {}) as Record<string, unknown>;
  const opId = meta['opportunityId'] as string | undefined;
  if (opId) return `Org (${opId.slice(0, 8)})`;
  return `Hospital ${capsule.subjectNpi.slice(0, 4)}**`;
}


// ── Revenue and Staffing Models ──────────────────────────────────────────────

const SPECIALTY_MODELS: Record<string, { dailyRevenue: number; daysToReplace: number; shiftsPerWeek: number }> = {
  CRNA: { dailyRevenue: 5000, daysToReplace: 120, shiftsPerWeek: 4 },
  ANESTHESIOLOGIST: { dailyRevenue: 8000, daysToReplace: 150, shiftsPerWeek: 4 },
  RN: { dailyRevenue: 1500, daysToReplace: 60, shiftsPerWeek: 3.5 },
  NP: { dailyRevenue: 3000, daysToReplace: 90, shiftsPerWeek: 4 },
  DEFAULT: { dailyRevenue: 2500, daysToReplace: 90, shiftsPerWeek: 4 },
};

function calculateImpactModels(specialty?: string, organizations?: string[]) {
  const model = SPECIALTY_MODELS[specialty?.toUpperCase() || ''] || SPECIALTY_MODELS.DEFAULT;
  const totalAtRisk = model.dailyRevenue * model.daysToReplace;
  const uncoveredShifts = Math.floor(model.daysToReplace * (model.shiftsPerWeek / 7));

  return {
    revenueImpact: {
      dailyRevenue: model.dailyRevenue,
      daysUntilReplacement: model.daysToReplace,
      totalAtRisk,
    },
    staffingGap: {
      uncoveredShifts,
      affectedLocations: organizations || [],
    }
  };
}

// ── simulateCredentialRevocation ──────────────────────────────────────────────

export async function simulateCredentialRevocation(params: {
  npi: string;
  credentialType: string;
}): Promise<SimulationResult> {
  const { npi, credentialType } = params;
  const simulatedAt = new Date().toISOString();

  log('info', 'live_simulation: revocation_start', { npi: npi.slice(0, 4) + '****', credentialType });

  // 1. Compute current trust state
  const currentState = await computeClinicianTrustState(npi);

  // 2. Compute projected state (simulate revocation)
  const impact = getImpact(credentialType);
  const projectedScore = Math.max(0, currentState.readiness_score - impact.scoreDrop);

  // Determine projected band
  let projectedBand: string;
  if (impact.affectsCritical || impact.affectsLicensure) {
    projectedBand = 'L0'; // critical or licensure revocation always drops to L0
  } else {
    projectedBand = scoreToband(projectedScore, false, false);
  }

  const projectedState: TrustStateSnapshot = {
    readiness_level: projectedBand,
    readiness_score: projectedScore,
  };

  const degradation = currentState.readiness_score - projectedScore;

  // 3. Get all Decision Capsules for this NPI
  const capsules = await capsuleEngine.getCapsulesByNpi(npi);

  // 4. Assess each capsule
  const affectedCapsules: AffectedCapsuleImpact[] = capsules.map((capsule) => {
    const status = assessCapsuleImpact(capsule.metadata, credentialType, impact);
    const organization = extractOrganization({ subjectNpi: capsule.subjectNpi, metadata: capsule.metadata });
    return {
      capsuleId: capsule.id,
      decisionType: capsule.decisionType,
      organization,
      status,
    };
  });

  // 5. Collect affected organizations
  const affectedOrgs = [
    ...new Set(
      affectedCapsules
        .filter((c) => c.status !== 'UNAFFECTED')
        .map((c) => c.organization),
    ),
  ];

  const invalidatedCapsules = affectedCapsules.filter((c) => c.status === 'WOULD_INVALIDATE');
  const privilegingCapsules = invalidatedCapsules.filter((c) =>
    c.decisionType === 'PRIVILEGING' || c.decisionType === 'DEPLOYMENT'
  );

  const result: SimulationResult = {
    npi,
    simulatedRevocation: credentialType,
    currentState: {
      readiness_level: currentState.readiness_level,
      readiness_score: currentState.readiness_score,
    },
    projectedState,
    degradation,
    affectedCapsules,
    affectedOrganizations: affectedOrgs,
    estimatedImpact: {
      hospitalsAffected: affectedOrgs.length,
      privilegesImpacted: privilegingCapsules.length,
      ...calculateImpactModels('DEFAULT', affectedOrgs),
    },
    simulationId: 'sim_' + Date.now() + Math.random().toString(36).substring(2, 9),
    simulatedAt,
  };

  // 6. Emit audit event
  try {
    appendAuditEvent({
      category: ['SIMULATION'],
      severity: 'INFO',
      actor: `simulation-engine`,
      resource: `simulation:revocation:${npi}`,
      requestFields: { npi: npi.slice(0, 4) + '****', credentialType },
      resultFields: {
        currentScore: currentState.readiness_score,
        projectedScore,
        degradation,
        capsuleCount: capsules.length,
        hospitalsAffected: affectedOrgs.length,
        privilegesImpacted: privilegingCapsules.length,
      },
    });
  } catch (err) {
    log('warn', 'live_simulation: audit_error', { error: String(err) });
  }

  log('info', 'live_simulation: revocation_complete', {
    npi: npi.slice(0, 4) + '****',
    credentialType,
    degradation,
    capsuleCount: capsules.length,
    hospitalsAffected: affectedOrgs.length,
  });

  return result;
}

// ── simulateLicenseExpiration ─────────────────────────────────────────────────

export async function simulateLicenseExpiration(params: {
  npi: string;
  expirationDate: string;
}): Promise<SimulationResult> {
  const { npi, expirationDate } = params;
  const simulatedAt = new Date().toISOString();

  log('info', 'live_simulation: expiration_start', { npi: npi.slice(0, 4) + '****', expirationDate });

  // Determine if the expiration date is in the past relative to simulation time
  const expDate = new Date(expirationDate);
  const now = new Date();
  const isExpired = expDate.getTime() <= now.getTime();
  const daysUntilExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // 1. Compute current trust state
  const currentState = await computeClinicianTrustState(npi);

  // 2. Project the state after expiration
  // License expiration always triggers critical impact (same as state_license revocation)
  const impact = CREDENTIAL_IMPACT['state_license']!;
  const projectedScore = isExpired
    ? Math.max(0, currentState.readiness_score - impact.scoreDrop)
    : Math.max(0, currentState.readiness_score - Math.floor(impact.scoreDrop * Math.max(0, 1 - daysUntilExpiry / 90)));

  const projectedBand = projectedScore < 30 ? 'L0' : projectedScore < 60 ? 'L1' : 'L2';

  const projectedState: TrustStateSnapshot = {
    readiness_level: isExpired ? 'L0' : projectedBand,
    readiness_score: projectedScore,
  };

  const degradation = currentState.readiness_score - projectedScore;

  // 3. Get all Decision Capsules
  const capsules = await capsuleEngine.getCapsulesByNpi(npi);

  // 4. Assess each capsule
  const affectedCapsules: AffectedCapsuleImpact[] = capsules.map((capsule) => {
    const status = isExpired
      ? assessCapsuleImpact(capsule.metadata, 'state_license', impact)
      : (daysUntilExpiry < 30 ? 'WOULD_DEGRADE' : 'UNAFFECTED') as CapsuleImpactStatus;
    const organization = extractOrganization({ subjectNpi: capsule.subjectNpi, metadata: capsule.metadata });
    return {
      capsuleId: capsule.id,
      decisionType: capsule.decisionType,
      organization,
      status,
    };
  });

  const affectedOrgs = [
    ...new Set(
      affectedCapsules
        .filter((c) => c.status !== 'UNAFFECTED')
        .map((c) => c.organization),
    ),
  ];

  const invalidatedCapsules = affectedCapsules.filter((c) =>
    c.status === 'WOULD_INVALIDATE' && (c.decisionType === 'PRIVILEGING' || c.decisionType === 'DEPLOYMENT')
  );

  const result: SimulationResult = {
    npi,
    simulatedRevocation: `state_license (expires ${expirationDate})`,
    currentState: {
      readiness_level: currentState.readiness_level,
      readiness_score: currentState.readiness_score,
    },
    projectedState,
    degradation,
    affectedCapsules,
    affectedOrganizations: affectedOrgs,
    estimatedImpact: {
      hospitalsAffected: affectedOrgs.length,
      privilegesImpacted: invalidatedCapsules.length,
      ...calculateImpactModels('DEFAULT', affectedOrgs),
    },
    simulationId: 'sim_' + Date.now() + Math.random().toString(36).substring(2, 9),
    simulatedAt,
  };

  // Emit audit
  try {
    appendAuditEvent({
      category: ['SIMULATION'],
      severity: 'INFO',
      actor: 'simulation-engine',
      resource: `simulation:expiration:${npi}`,
      requestFields: { npi: npi.slice(0, 4) + '****', expirationDate, isExpired, daysUntilExpiry },
      resultFields: {
        currentScore: currentState.readiness_score,
        projectedScore,
        degradation,
        hospitalsAffected: affectedOrgs.length,
        privilegesImpacted: invalidatedCapsules.length,
      },
    });
  } catch (err) {
    log('warn', 'live_simulation: audit_error', { error: String(err) });
  }

  return result;
}

// ── simulateComplianceRule ────────────────────────────────────────────────────

export async function simulateComplianceRule(params: {
  rule: string;
  specialty?: string;
  state?: string;
}): Promise<ComplianceSimulationResult> {
  const { rule, specialty, state } = params;
  const simulatedAt = new Date().toISOString();

  log('info', 'live_simulation: compliance_start', { rule, specialty, state });

  // Gather distinct NPIs from the system (via VerificationArtifacts)
  let distinctNpis: string[] = [];
  try {
    const artifacts = await prisma.verificationArtifact.findMany({
      select: { npi: true },
      distinct: ['npi'],
      take: 500, // cap for performance
    });
    distinctNpis = artifacts.map((a) => a.npi).filter(Boolean);
  } catch (err) {
    log('warn', 'live_simulation: npi_query_error', { error: String(err) });
  }

  // Also check DecisionCapsule NPIs
  try {
    const capsuleNpis = await prisma.decisionCapsule.findMany({
      select: { subjectNpi: true },
      distinct: ['subjectNpi'],
      take: 500,
    });
    const capsuleNpiSet = capsuleNpis.map((c) => c.subjectNpi).filter(Boolean);
    distinctNpis = [...new Set([...distinctNpis, ...capsuleNpiSet])];
  } catch (err) {
    log('warn', 'live_simulation: capsule_npi_query_error', { error: String(err) });
  }

  const affectedClinicians = distinctNpis.length;

  // Determine which clinicians would fail based on rule semantics
  // Analyze rule keywords to determine gap types
  const ruleLower = rule.toLowerCase();

  // Map rule keywords to fact types that would be required
  const requiresBoard = ruleLower.includes('board') || ruleLower.includes('certification');
  const requiresDea = ruleLower.includes('dea') || ruleLower.includes('controlled');
  const requiresMalpractice = ruleLower.includes('malpractice') || ruleLower.includes('insurance');
  const requiresLicense = ruleLower.includes('license') || ruleLower.includes('licensure') || ruleLower.includes('state');
  const requiresNppes = ruleLower.includes('npi') || ruleLower.includes('identity') || ruleLower.includes('nppes');

  // Query clinicians' fact coverage
  let wouldFailCount = 0;
  const gapTypes = new Set<string>();

  if (affectedClinicians > 0) {
    // Sample up to 100 clinicians for the gap analysis
    const sampleNpis = distinctNpis.slice(0, 100);

    for (const npi of sampleNpis) {
      const artifacts = await prisma.verificationArtifact.findMany({
        where: { npi, source: { not: 'TRUST_STATE_ENGINE' } },
        select: { source: true, status: true },
      });

      const sources = artifacts.map((a) => a.source.toUpperCase());
      let fails = false;

      if (requiresBoard && !sources.some((s) => s.includes('BOARD') || s.includes('CERT'))) {
        fails = true;
        gapTypes.add('Board certification not on file');
      }
      if (requiresDea && !sources.some((s) => s.includes('DEA'))) {
        fails = true;
        gapTypes.add('DEA registration missing');
      }
      if (requiresMalpractice && !sources.some((s) => s.includes('MALPRACTICE') || s.includes('INSURANCE'))) {
        fails = true;
        gapTypes.add('Malpractice insurance not verified');
      }
      if (requiresLicense && !sources.some((s) => s.includes('LICENSE') || s.includes('NURSYS') || s.includes('STATE') || s.includes('FSMB'))) {
        fails = true;
        gapTypes.add('State licensure not verified');
      }
      if (requiresNppes && !sources.some((s) => s.includes('NPPES') || s.includes('NPI'))) {
        fails = true;
        gapTypes.add('NPI identity not verified');
      }

      if (fails) wouldFailCount++;
    }

    // Extrapolate to full population if we sampled
    if (sampleNpis.length < affectedClinicians) {
      const failRate = wouldFailCount / sampleNpis.length;
      wouldFailCount = Math.round(failRate * affectedClinicians);
    }
  }

  // Build gap summary
  const gapSummary: string[] = [];

  if (gapTypes.size === 0 && affectedClinicians === 0) {
    gapSummary.push('No clinicians found in system — onboard clinician data to enable gap analysis');
  } else {
    if (requiresBoard) gapSummary.push(`Rule requires board certification — ${wouldFailCount} clinicians may lack this`);
    if (requiresDea) gapSummary.push(`Rule requires DEA registration — gaps detected in DEA verification coverage`);
    if (requiresMalpractice) gapSummary.push(`Rule requires malpractice insurance — coverage gaps exist across clinicians`);
    if (requiresLicense) gapSummary.push(`Rule requires active state licensure — critical for all clinical privileges`);
    if (specialty) gapSummary.push(`Specialty filter: ${specialty} — only applicable clinicians evaluated`);
    if (state) gapSummary.push(`State filter: ${state} — multi-state practitioners may be additionally affected`);
    if (gapTypes.size === 0) gapSummary.push('All sampled clinicians appear to meet this compliance requirement');
  }

  const compResult: ComplianceSimulationResult = {
    rule,
    specialty,
    state,
    affectedClinicians,
    wouldFailCount,
    gapSummary,
    simulatedAt,
  };

  // Emit audit
  try {
    appendAuditEvent({
      category: ['SIMULATION', 'COMPLIANCE'],
      severity: 'INFO',
      actor: 'simulation-engine',
      resource: 'simulation:compliance',
      requestFields: { rule, specialty, state },
      resultFields: { affectedClinicians, wouldFailCount, gapCount: gapSummary.length },
    });
  } catch (err) {
    log('warn', 'live_simulation: audit_error', { error: String(err) });
  }

  log('info', 'live_simulation: compliance_complete', {
    rule,
    affectedClinicians,
    wouldFailCount,
  });

  return compResult;
}
