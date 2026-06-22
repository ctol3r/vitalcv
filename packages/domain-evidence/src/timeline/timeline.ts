/**
 * Professional Memory / Timeline projection (Wave 225).
 *
 * Pure transform: (EvidenceCollection, GraphProjection, TrustProjection) ->
 * TimelineProjection. Deterministic, no I/O, no ML. Bridges the evidence /
 * graph / trust layers into a career-over-time view.
 *
 * Honesty: every event traces to a source-backed evidence object; trust impact
 * reuses the monotonic trust scores (W222) and is never inflated; reputation
 * standing is a deterministic threshold over decision-grade evidence, with an
 * honest 'unknown' when nothing is checked.
 */

import type { EvidenceClass, EvidenceCollection } from '../types';
import type { GraphProjection } from '../projectors/graph';
import { statusTrustScore } from '../projectors/graph';
import type { TrustDimension, TrustHistory, TrustProjection } from '../trust/propagate';

// ── C2: CareerEvent ──────────────────────────────────────────────────────────

export const CAREER_EVENT_TYPES = [
  'identity_verification',
  'licensure',
  'certification',
  'screening',
  'enrollment',
  'recognition',
  'acceptance',
  'employment_start',
  'employment',
  'training',
  'privileging',
  'peer_review',
  'research',
] as const;

export type CareerEventType = (typeof CAREER_EVENT_TYPES)[number];

export type MobilityImpact = 'expands' | 'reduces' | 'none';
export type RecognitionImpact = 'recognition' | 'acceptance' | 'start' | 'none';

export interface CareerEvent {
  eventId: string;
  occurredAt: string | null;
  type: CareerEventType;
  label: string;
  detail: string;
  evidenceId: string | null;
  evidenceSource: string | null;
  /** Signed trust delta (+ reinforcement, − decay), bounded by the evidence's own trust. */
  trustImpact: number;
  trustDimension: TrustDimension | null;
  mobilityImpact: MobilityImpact;
  recognitionImpact: RecognitionImpact;
}

export type ReputationStanding = 'established' | 'emerging' | 'provisional' | 'unknown';

export interface ReputationSummary {
  overallTrust: number | null;
  decisionGradeEvidence: number;
  totalEvidence: number;
  reinforcementCount: number;
  decayCount: number;
  trend: 'growing' | 'decaying' | 'stable';
  standing: ReputationStanding;
}

export interface TimelineProjection {
  subjectKey: string;
  events: CareerEvent[];
  /** Pass-through of the already timeline-shaped trust history (W222). */
  trustHistory: TrustHistory;
  /** Subset of events with recognitionImpact !== 'none'. */
  recognition: CareerEvent[];
  reputation: ReputationSummary;
  firstAt: string | null;
  lastAt: string | null;
}

// ── Derivations ──────────────────────────────────────────────────────────────

function eventTypeForClass(evidenceClass: EvidenceClass): CareerEventType {
  switch (evidenceClass) {
    case 'identity':
      return 'identity_verification';
    case 'licensure':
      return 'licensure';
    case 'registration':
      return 'licensure';
    case 'board_cert':
      return 'certification';
    case 'exclusion':
      return 'screening';
    case 'enrollment':
      return 'enrollment';
    case 'recognition':
      return 'recognition';
    case 'acceptance':
      return 'acceptance';
    case 'start':
      return 'employment_start';
    case 'employment':
      return 'employment';
    case 'training':
      return 'training';
    case 'privilege':
      return 'privileging';
    case 'peer_review':
      return 'peer_review';
    case 'research':
    case 'publication':
      return 'research';
    default:
      return 'identity_verification';
  }
}

function recognitionImpactForClass(evidenceClass: EvidenceClass): RecognitionImpact {
  switch (evidenceClass) {
    case 'recognition':
      return 'recognition';
    case 'acceptance':
      return 'acceptance';
    case 'start':
      return 'start';
    default:
      return 'none';
  }
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** Find the primary trust dimension an evidence node contributes to. */
function dimensionForEvidence(trust: TrustProjection, evidenceId: string): TrustDimension | null {
  for (const d of trust.dimensions) {
    if (d.supporting.includes(evidenceId) || d.weakening.includes(evidenceId)) {
      return d.dimension;
    }
  }
  return null;
}

function standingFor(overallTrust: number | null, decisionGradeEvidence: number): ReputationStanding {
  if (decisionGradeEvidence === 0 || overallTrust === null) return 'unknown';
  if (overallTrust >= 0.67) return 'established';
  if (overallTrust >= 0.34) return 'emerging';
  return 'provisional';
}

// ── C3: TimelineProjection ───────────────────────────────────────────────────

export function projectTimeline(
  evidence: EvidenceCollection,
  graph: GraphProjection,
  trust: TrustProjection,
): TimelineProjection {
  const events: CareerEvent[] = [];

  for (const node of graph.nodes) {
    if (node.type !== 'evidence' || !node.evidenceClass || node.trustScore === null) continue;

    const score = node.trustScore;
    const decayed = node.status === 'stale' || node.lifecycle === 'expired' || node.lifecycle === 'revoked';
    const trustImpact = decayed ? round4(-(1 - score)) : node.status === 'checked' ? round4(score) : 0;

    const isLicense = node.evidenceClass === 'licensure' || node.evidenceClass === 'registration';
    const mobilityImpact: MobilityImpact = isLicense
      ? node.status === 'checked'
        ? 'expands'
        : decayed
          ? 'reduces'
          : 'none'
      : 'none';

    const occurredAt = decayed ? node.expiresAt ?? node.checkedAt : node.checkedAt;

    events.push({
      eventId: `${node.id}@${occurredAt ?? 'undated'}`,
      occurredAt,
      type: eventTypeForClass(node.evidenceClass),
      label: node.label,
      detail: `${node.label} — ${node.status}`,
      evidenceId: node.id,
      evidenceSource: node.evidenceSource,
      trustImpact,
      trustDimension: dimensionForEvidence(trust, node.id),
      mobilityImpact,
      recognitionImpact: recognitionImpactForClass(node.evidenceClass),
    });
  }

  // Deterministic order: ascending by timestamp, nulls last, tiebreak eventId.
  events.sort((a, b) => {
    if (a.occurredAt === b.occurredAt) return a.eventId.localeCompare(b.eventId);
    if (a.occurredAt === null) return 1;
    if (b.occurredAt === null) return -1;
    return a.occurredAt.localeCompare(b.occurredAt);
  });

  const stamped = events.filter((e) => e.occurredAt).map((e) => e.occurredAt!);
  const reputation: ReputationSummary = {
    overallTrust: trust.overall.score,
    decisionGradeEvidence: trust.overall.decisionGradeEvidence,
    totalEvidence: trust.overall.totalEvidence,
    reinforcementCount: trust.history.reinforcementCount,
    decayCount: trust.history.decayCount,
    trend: trust.history.trend,
    standing: standingFor(trust.overall.score, trust.overall.decisionGradeEvidence),
  };

  return {
    subjectKey: evidence.subjectKey,
    events,
    trustHistory: trust.history,
    recognition: events.filter((e) => e.recognitionImpact !== 'none'),
    reputation,
    firstAt: stamped[0] ?? null,
    lastAt: stamped[stamped.length - 1] ?? null,
  };
}
