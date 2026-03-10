/**
 * Waves 208–210 — Readiness Engine + Clear-to-Start
 */
import { getEndorsementDelay, NLC_COMPACT_STATES, COUNSELING_COMPACT_STATES } from './endorsementDelays';
import type { PsvArtifact } from '../../psv-adapters/types';

export interface ReadinessReport {
  npi: string; targetState: string; profession: string;
  overallStatus: 'CLEAR_TO_START' | 'PENDING_VERIFICATION' | 'MISSING_CREDENTIALS' | 'BLOCKED';
  readinessScore: number;
  what_you_have: { credential: string; status: string; verifiedAt?: string }[];
  what_is_missing: { credential: string; priority: 'HIGH' | 'MEDIUM' | 'LOW'; instructions: string }[];
  what_is_pending: { credential: string; estimatedDays: number; notes: string }[];
  endorsement_timeline: { state: string; profession: string; estimatedDays: number; compactApplicable: boolean };
  clearToStartDate?: string;
}

function compactApplicable(profession: string, fromState: string, toState: string): boolean {
  if (['RN', 'LPN', 'APRN'].includes(profession)) return NLC_COMPACT_STATES.includes(fromState) && NLC_COMPACT_STATES.includes(toState);
  if (['LPC', 'LMHC'].includes(profession)) return COUNSELING_COMPACT_STATES.includes(fromState) && COUNSELING_COMPACT_STATES.includes(toState);
  return false;
}

export function computeReadiness(npi: string, targetState: string, profession: string, artifacts: PsvArtifact[]): ReadinessReport {
  const active = artifacts.filter((a) => a.status === 'ACTIVE');
  const notFound = artifacts.filter((a) => a.status === 'NOT_FOUND' || a.status === 'ERROR');
  const readinessScore = artifacts.length > 0 ? Math.round((active.length / artifacts.length) * 100) : 50;

  const licenseArtifact = active.find((a) => a.state && a.licenseNumber);
  const fromState = licenseArtifact?.state;
  const compact = fromState ? compactApplicable(profession, fromState, targetState) : false;
  const delay = getEndorsementDelay(targetState, profession);
  const estimatedDays = compact ? 3 : (delay ? Math.round((delay.typicalDaysMin + delay.typicalDaysMax) / 2) : 45);

  const clearToStartDate = new Date(Date.now() + estimatedDays * 86_400_000).toISOString().slice(0, 10);

  const what_you_have = active.map((a) => ({ credential: a.source, status: a.status, verifiedAt: a.retrievalTimestampUtc }));
  const what_is_missing = notFound.map((a) => ({ credential: a.source, priority: 'HIGH' as const, instructions: `Request verification from ${a.source}` }));
  const what_is_pending = estimatedDays > 0 ? [{ credential: `${targetState} ${profession} License Endorsement`, estimatedDays, notes: compact ? 'Compact privilege — expedited' : (delay?.notes ?? 'Standard endorsement') }] : [];
  const overallStatus: ReadinessReport['overallStatus'] = what_is_missing.length === 0 && readinessScore >= 80 ? 'CLEAR_TO_START' : what_is_missing.length > 0 ? 'MISSING_CREDENTIALS' : 'PENDING_VERIFICATION';

  return { npi, targetState, profession, overallStatus, readinessScore, what_you_have, what_is_missing, what_is_pending, endorsement_timeline: { state: targetState, profession, estimatedDays, compactApplicable: compact }, clearToStartDate };
}
