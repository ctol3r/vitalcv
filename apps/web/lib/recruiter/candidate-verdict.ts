/**
 * Recruiter candidate verdict (Wave 310) — pure, testable.
 *
 * Maps the candidate's mobility readiness + trust standing to a recruiter
 * placement decision. Honest by construction: "move forward" requires a
 * decision-grade `ready` candidate with established/emerging standing; gated,
 * near-ready, or unknown coverage degrades — never green-lights a thin candidate.
 */

import type { MobilityReadiness, ReputationStanding } from '@vitalcv/domain-evidence';

export type RecruiterVerdict = 'move_forward' | 'request_evidence' | 'not_ready' | 'insufficient';

export const RECRUITER_VERDICT_LABEL: Record<RecruiterVerdict, string> = {
  move_forward: 'Move forward',
  request_evidence: 'Request more evidence',
  not_ready: 'Not ready',
  insufficient: 'Insufficient evidence',
};

export function deriveRecruiterVerdict(
  readiness: MobilityReadiness,
  standing: ReputationStanding,
): RecruiterVerdict {
  if (readiness === 'blocked') return 'not_ready';
  if (readiness === 'unknown' || standing === 'unknown') return 'insufficient';
  if (readiness === 'ready' && (standing === 'established' || standing === 'emerging')) return 'move_forward';
  return 'request_evidence';
}
