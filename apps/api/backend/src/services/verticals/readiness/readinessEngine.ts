/**
 * Waves 208–210 — Readiness Engine + Clear-to-Start
 */
import { getEndorsementDelay, NLC_COMPACT_STATES, COUNSELING_COMPACT_STATES } from './endorsementDelays';
import type { PsvArtifact } from '../../psv-adapters/types';
import {
  computeDeterministicTrustReadiness,
  resolveSourceCoverageState,
  type TrustSourceCoverage,
} from '../../trust/trustCore';

export interface ReadinessReport {
  npi: string; targetState: string; profession: string;
  overallStatus: 'CLEAR_TO_START' | 'PENDING_VERIFICATION' | 'MISSING_CREDENTIALS' | 'BLOCKED';
  readinessScore: number;
  blockers: string[];
  readiness_score: number;
  nextActions: string[];
  confidenceWeighting: Record<'identity' | 'exclusion' | 'licensure' | 'enrollment', number>;
  sourceCoverage: TrustSourceCoverage[];
  what_you_have: { credential: string; status: string; verifiedAt?: string }[];
  what_is_missing: { credential: string; priority: 'HIGH' | 'MEDIUM' | 'LOW'; instructions: string }[];
  what_is_pending: { credential: string; estimatedDays: number; notes: string }[];
  endorsement_timeline: { state: string; profession: string; estimatedDays: number; compactApplicable: boolean };
  clearToStartDate?: string;
}

type EnrollmentEligibilityState = 'ENROLLED' | 'NOT_FOUND' | 'UNKNOWN' | 'UNCHECKED';

function artifactLooksMock(artifact: PsvArtifact | undefined): boolean {
  if (!artifact) {
    return false;
  }

  const rawPayload = artifact.rawPayload.toLowerCase();
  return rawPayload.includes('"stub":true')
    || rawPayload.includes('"source":"mock')
    || rawPayload.includes('"previewonly":true')
    || rawPayload.includes('"decisiongrade":false')
    || rawPayload.includes('"sourcemode":"sandbox"')
    || rawPayload.includes('"source":"simulated')
    || rawPayload.includes('npi-prefix');
}

function resolveEnrollmentEligibilityState(
  artifact: PsvArtifact | undefined,
): EnrollmentEligibilityState {
  if (!artifact) {
    return 'UNCHECKED';
  }
  if (artifact.status === 'ACTIVE') {
    return 'ENROLLED';
  }
  if (artifact.status === 'NOT_FOUND') {
    return 'NOT_FOUND';
  }
  return 'UNKNOWN';
}

function compactApplicable(profession: string, fromState: string, toState: string): boolean {
  if (['RN', 'LPN', 'APRN'].includes(profession)) return NLC_COMPACT_STATES.includes(fromState) && NLC_COMPACT_STATES.includes(toState);
  if (['LPC', 'LMHC'].includes(profession)) return COUNSELING_COMPACT_STATES.includes(fromState) && COUNSELING_COMPACT_STATES.includes(toState);
  return false;
}

export function computeReadiness(npi: string, targetState: string, profession: string, artifacts: PsvArtifact[]): ReadinessReport {
  const identityArtifact = artifacts.find((artifact) => artifact.source.toUpperCase().includes('NPPES'));
  const exclusionArtifact = artifacts.find((artifact) => artifact.source.toUpperCase().includes('OIG') || artifact.source.toUpperCase().includes('LEIE'));
  const licensureArtifact = artifacts.find((artifact) =>
    artifact.source.toUpperCase().includes('STATE')
    || artifact.source.toUpperCase().includes('BOARD')
    || artifact.source.toUpperCase().includes('NURSYS'),
  );
  const enrollmentArtifact = artifacts.find((artifact) => artifact.source.toUpperCase().includes('PECOS'));
  const identityMock = artifactLooksMock(identityArtifact);
  const exclusionMock = artifactLooksMock(exclusionArtifact);
  const licensureMock = artifactLooksMock(licensureArtifact);
  const enrollmentMock = artifactLooksMock(enrollmentArtifact);

  const licenseArtifact = licensureArtifact?.status === 'ACTIVE' ? licensureArtifact : undefined;
  const fromState = licenseArtifact?.state;
  const compact = fromState ? compactApplicable(profession, fromState, targetState) : false;
  const delay = getEndorsementDelay(targetState, profession);
  const estimatedDays = compact ? 3 : (delay ? Math.round((delay.typicalDaysMin + delay.typicalDaysMax) / 2) : 45);
  const enrollmentState = resolveEnrollmentEligibilityState(enrollmentArtifact);

  const clearToStartDate = new Date(Date.now() + estimatedDays * 86_400_000).toISOString().slice(0, 10);

  const identityCoverage: TrustSourceCoverage = {
    sourceId: 'NPPES_API',
    state: resolveSourceCoverageState({
      sourceId: 'NPPES_API',
      checked: Boolean(identityArtifact),
      fresh: identityArtifact?.status === 'ACTIVE',
      unavailable: identityArtifact?.status === 'ERROR',
      notDecisionGrade: identityMock,
    }),
    reason:
      identityMock
        ? 'NPPES identity evidence is not decision-grade and excluded'
        : !identityArtifact
        ? 'NPPES identity source not yet checked'
        : identityArtifact.status === 'ACTIVE'
          ? 'NPPES identity checked'
          : 'NPPES identity evidence unresolved',
    checkedAt: identityArtifact?.retrievalTimestampUtc ?? null,
    artifactId: identityArtifact?.artifactId ?? null,
    sourceUrl: identityArtifact?.sourceUrl ?? null,
    rawArtifactRef: identityArtifact?.artifactId ?? null,
    checksum: identityArtifact?.checksum ?? null,
  };
  const exclusionCoverage: TrustSourceCoverage = {
    sourceId: 'OIG_LEIE',
    state: resolveSourceCoverageState({
      sourceId: 'OIG_LEIE',
      checked: Boolean(exclusionArtifact),
      fresh: exclusionArtifact?.status === 'ACTIVE',
      unavailable: exclusionArtifact?.status === 'ERROR',
      notDecisionGrade: exclusionMock,
    }),
    reason:
      exclusionMock
        ? 'OIG LEIE evidence is not decision-grade and excluded'
        : !exclusionArtifact
        ? 'OIG LEIE source not yet checked'
        : exclusionArtifact.status === 'ACTIVE'
          ? 'OIG LEIE check complete'
          : 'OIG LEIE evidence unresolved',
    checkedAt: exclusionArtifact?.retrievalTimestampUtc ?? null,
    artifactId: exclusionArtifact?.artifactId ?? null,
    sourceUrl: exclusionArtifact?.sourceUrl ?? null,
    rawArtifactRef: exclusionArtifact?.artifactId ?? null,
    checksum: exclusionArtifact?.checksum ?? null,
  };
  const licensureCoverage: TrustSourceCoverage = {
    sourceId: licensureArtifact?.source ?? 'STATE_BOARD',
    state: resolveSourceCoverageState({
      sourceId: licensureArtifact?.source ?? 'STATE_BOARD',
      checked: Boolean(licensureArtifact),
      fresh: licensureArtifact?.status === 'ACTIVE',
      unavailable: licensureArtifact?.status === 'ERROR',
      notDecisionGrade: licensureMock,
    }),
    reason:
      licensureMock
        ? 'Licensure evidence is not decision-grade and excluded'
        : !licensureArtifact
        ? 'Licensure source not yet checked'
        : licensureArtifact.status === 'ACTIVE'
          ? 'Licensure check complete'
          : licensureArtifact.status === 'EXPIRED'
            ? 'Licensure source reports an expired credential'
            : 'Licensure evidence unresolved',
    checkedAt: licensureArtifact?.retrievalTimestampUtc ?? null,
    artifactId: licensureArtifact?.artifactId ?? null,
    sourceUrl: licensureArtifact?.sourceUrl ?? null,
    rawArtifactRef: licensureArtifact?.artifactId ?? null,
    checksum: licensureArtifact?.checksum ?? null,
  };
  const enrollmentCoverage: TrustSourceCoverage = {
    sourceId: 'PECOS_PUBLIC',
    state: resolveSourceCoverageState({
      sourceId: 'PECOS_PUBLIC',
      checked: Boolean(enrollmentArtifact),
      fresh: enrollmentState === 'ENROLLED' || enrollmentState === 'NOT_FOUND',
      unavailable: enrollmentArtifact?.status === 'ERROR',
      notDecisionGrade: enrollmentMock,
    }),
    reason:
      enrollmentMock
        ? 'PECOS evidence is not decision-grade and excluded'
        : !enrollmentArtifact
        ? 'PECOS source not yet checked'
        : enrollmentState === 'ENROLLED'
          ? 'PECOS quarterly enrollment checked'
          : enrollmentState === 'NOT_FOUND'
            ? 'PECOS quarterly enrollment not found'
            : 'PECOS enrollment outcome unresolved',
    checkedAt: enrollmentArtifact?.retrievalTimestampUtc ?? null,
    artifactId: enrollmentArtifact?.artifactId ?? null,
    sourceUrl: enrollmentArtifact?.sourceUrl ?? null,
    rawArtifactRef: enrollmentArtifact?.artifactId ?? null,
    checksum: enrollmentArtifact?.checksum ?? null,
  };

  const readiness = computeDeterministicTrustReadiness({
    identity: {
      dimension: 'identity',
      status: identityArtifact?.status === 'ACTIVE' ? 'MET' : 'UNMET',
      confidence: identityArtifact?.status === 'ACTIVE' ? 0.99 : 0.25,
      blocker: identityArtifact?.status === 'ACTIVE' ? null : 'Identity not verified',
      gap: identityArtifact ? null : 'NPPES identity artifact missing',
      sourceCoverage: [identityCoverage],
    },
    exclusion: {
      dimension: 'exclusion',
      status:
        exclusionArtifact?.status === 'ACTIVE'
          ? 'MET'
          : exclusionArtifact?.status === 'ERROR'
            ? 'REVIEW_REQUIRED'
            : 'UNMET',
      confidence: exclusionArtifact?.status === 'ACTIVE' ? 0.95 : exclusionArtifact ? 0.55 : 0.25,
      blocker: exclusionArtifact?.status === 'ERROR' ? 'OIG/LEIE check could not be confirmed' : null,
      gap: exclusionArtifact ? null : 'OIG exclusion artifact missing',
      sourceCoverage: [exclusionCoverage],
    },
    licensure: {
      dimension: 'licensure',
      status:
        licensureArtifact?.status === 'ACTIVE'
          ? 'MET'
          : licensureArtifact?.status === 'EXPIRED'
            ? 'BLOCKED'
            : 'UNMET',
      confidence: licensureArtifact?.status === 'ACTIVE' || licensureArtifact?.status === 'EXPIRED' ? 0.95 : 0.25,
      blocker: licensureArtifact?.status === 'EXPIRED' ? 'State license expired' : null,
      gap: licensureArtifact ? null : 'State license artifact missing',
      sourceCoverage: [licensureCoverage],
    },
    enrollment: {
      dimension: 'enrollment',
      status:
        enrollmentState === 'ENROLLED'
          ? 'MET'
          : enrollmentState === 'NOT_FOUND'
            ? 'BLOCKED'
            : 'UNMET',
      confidence: enrollmentState === 'UNKNOWN' || enrollmentState === 'UNCHECKED' ? 0.25 : 0.95,
      blocker: enrollmentState === 'NOT_FOUND' ? 'PECOS quarterly enrollment not found' : null,
      gap:
        enrollmentState === 'UNCHECKED'
          ? 'PECOS enrollment not yet checked'
          : enrollmentState === 'UNKNOWN'
            ? 'PECOS enrollment outcome unresolved'
            : null,
      sourceCoverage: [enrollmentCoverage],
    },
  });
  const readinessScore =
    enrollmentState === 'ENROLLED'
      ? readiness.readinessScore
      : Math.min(readiness.readinessScore, 59);

  const what_you_have = artifacts
    .filter((artifact) => artifact.status === 'ACTIVE')
    .map((artifact) => ({ credential: artifact.source, status: artifact.status, verifiedAt: artifact.retrievalTimestampUtc }));
  const what_is_missing = readiness.gaps.map((gap) => ({
    credential: gap,
    priority: 'HIGH' as const,
    instructions: `Resolve ${gap.toLowerCase()}.`,
  }));
  const what_is_pending = estimatedDays > 0 ? [{ credential: `${targetState} ${profession} License Endorsement`, estimatedDays, notes: compact ? 'Compact privilege — expedited' : (delay?.notes ?? 'Standard endorsement') }] : [];
  const nextActions = readiness.nextActions.length > 0 ? readiness.nextActions : ['Ready to Apply'];

  return {
    npi,
    targetState,
    profession,
    overallStatus: readiness.overallStatus,
    readinessScore,
    readiness_score: readinessScore,
    blockers: readiness.blockers,
    nextActions,
    confidenceWeighting: readiness.confidenceWeighting,
    sourceCoverage: readiness.sourceCoverage,
    what_you_have,
    what_is_missing,
    what_is_pending,
    endorsement_timeline: { state: targetState, profession, estimatedDays, compactApplicable: compact },
    clearToStartDate,
  };
}
