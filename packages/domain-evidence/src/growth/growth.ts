/**
 * Professional Growth (Wave 520).
 *
 * Pure, deterministic, explainable derivation of a clinician's career arc over the
 * evidence / trust / timeline projections: professional milestones (C1), a career
 * progression engine (C2), growth-readiness gaps (C3), and a mentorship relationship
 * model (C4). Reuses existing projections; no rewrites.
 *
 * Honesty: milestones carry their decision-grade status; a stage backed only by
 * self-reported evidence is shown as reached-but-unverified, never as decision-grade.
 * Mentorship DATA is external (a clinician's mentors aren't in source-checked
 * evidence) — this provides the typed model + integration point, not fabricated links.
 */

import type { EvidenceClass, EvidenceCollection } from '../types';
import type { TrustProjection } from '../trust/propagate';
import type { ReputationStanding, TimelineProjection } from '../timeline/timeline';

// ── C1: Milestones ───────────────────────────────────────────────────────────

export type MilestoneType = 'training' | 'licensure' | 'certification' | 'screening' | 'enrollment' | 'employment' | 'recognition';

export interface Milestone {
  id: string;
  type: MilestoneType;
  title: string;
  occurredAt: string | null;
  decisionGrade: boolean;
  evidenceId: string;
}

const MILESTONE_FOR_CLASS: Partial<Record<EvidenceClass, MilestoneType>> = {
  training: 'training',
  licensure: 'licensure',
  registration: 'licensure',
  board_cert: 'certification',
  exclusion: 'screening',
  enrollment: 'enrollment',
  employment: 'employment',
  recognition: 'recognition',
  acceptance: 'recognition',
  start: 'employment',
};

function deriveMilestones(evidence: EvidenceCollection): Milestone[] {
  const milestones: Milestone[] = [];
  for (const obj of evidence.objects) {
    const type = MILESTONE_FOR_CLASS[obj.evidenceClass];
    if (!type) continue;
    milestones.push({
      id: `milestone:${obj.evidenceId}`,
      type,
      title: obj.label,
      occurredAt: obj.checkedAt ?? obj.observedAt ?? null,
      decisionGrade: obj.decisionGrade,
      evidenceId: obj.evidenceId,
    });
  }
  milestones.sort((a, b) => {
    if (a.occurredAt === b.occurredAt) return a.id.localeCompare(b.id);
    if (a.occurredAt === null) return 1;
    if (b.occurredAt === null) return -1;
    return a.occurredAt.localeCompare(b.occurredAt);
  });
  return milestones;
}

// ── C2: Career progression ───────────────────────────────────────────────────

export type CareerStage = 'training' | 'licensed' | 'practicing' | 'board_certified' | 'established';
export const CAREER_ARC: CareerStage[] = ['training', 'licensed', 'practicing', 'board_certified', 'established'];

export interface CareerProgression {
  stage: CareerStage | null;
  stagesReached: CareerStage[];
  nextStage: CareerStage | null;
  /** 0..1 through the arc. */
  progress: number;
}

/** A stage is reached only by DECISION-GRADE evidence — never by gated/stale/
 * self-reported items, which can be career facts but not verified progression. */
function hasDecisionGrade(evidence: EvidenceCollection, ...classes: EvidenceClass[]): boolean {
  return classes.some((c) => (evidence.byClass[c] ?? []).some((o) => o.decisionGrade));
}

function deriveProgression(evidence: EvidenceCollection, standing: ReputationStanding): CareerProgression {
  const reached = new Set<CareerStage>();
  if (hasDecisionGrade(evidence, 'training')) reached.add('training');
  if (hasDecisionGrade(evidence, 'licensure', 'registration')) reached.add('licensed');
  if (hasDecisionGrade(evidence, 'employment', 'recognition', 'acceptance', 'start')) reached.add('practicing');
  if (hasDecisionGrade(evidence, 'board_cert')) reached.add('board_certified');
  // 'established' is a capstone: every prior career stage verified AND established standing.
  const careerStagesReached = (['training', 'licensed', 'practicing', 'board_certified'] as CareerStage[]).every((s) => reached.has(s));
  if (careerStagesReached && standing === 'established') reached.add('established');

  const stagesReached = CAREER_ARC.filter((s) => reached.has(s));
  const stage = stagesReached.length > 0 ? stagesReached[stagesReached.length - 1] : null;
  const stageIdx = stage ? CAREER_ARC.indexOf(stage) : -1;
  const nextStage = CAREER_ARC.slice(stageIdx + 1).find((s) => !reached.has(s)) ?? null;
  const progress = stage ? Math.round(((CAREER_ARC.indexOf(stage) + 1) / CAREER_ARC.length) * 10000) / 10000 : 0;
  return { stage, stagesReached, nextStage, progress };
}

// ── C3: Growth-readiness gaps ────────────────────────────────────────────────

export interface GrowthGap {
  id: string;
  title: string;
  toReachStage: CareerStage;
  rationale: string;
}

const STAGE_GUIDANCE: Record<CareerStage, string> = {
  training: 'Add source-backed training/education evidence.',
  licensed: 'Obtain and verify a state license (a launch-spine, decision-grade source).',
  practicing: 'Record employment or a recognition event.',
  board_certified: 'Add board certification evidence.',
  established: 'Strengthen source-backed evidence across dimensions to reach established standing.',
};

function deriveGrowthGaps(progression: CareerProgression): GrowthGap[] {
  return CAREER_ARC
    .filter((s) => !progression.stagesReached.includes(s))
    .map((s) => ({ id: `growth:${s}`, title: `Advance to ${s.replace('_', ' ')}`, toReachStage: s, rationale: STAGE_GUIDANCE[s] }));
}

// ── C4: Mentorship model (data is external) ──────────────────────────────────

export type MentorshipRole = 'mentor' | 'mentee';

export interface MentorshipRelationship {
  from: string;
  to: string;
  role: MentorshipRole;
  context: string;
  since: string | null;
}

/** Build a mentorship link from declared inputs (the data source is external — e.g.
 * a program roster or attestation — not source-checked evidence). */
export function buildMentorship(input: { from: string; to: string; role: MentorshipRole; context: string; since?: string | null }): MentorshipRelationship {
  return { from: input.from, to: input.to, role: input.role, context: input.context, since: input.since ?? null };
}

// ── Projection ───────────────────────────────────────────────────────────────

export interface ProfessionalGrowthProjection {
  subjectKey: string;
  milestones: Milestone[];
  progression: CareerProgression;
  growthGaps: GrowthGap[];
  mentorship: MentorshipRelationship[];
}

export function projectProfessionalGrowth(
  evidence: EvidenceCollection,
  _trust: TrustProjection,
  timeline: TimelineProjection,
  mentorship: MentorshipRelationship[] = [],
): ProfessionalGrowthProjection {
  const progression = deriveProgression(evidence, timeline.reputation.standing);
  return {
    subjectKey: evidence.subjectKey,
    milestones: deriveMilestones(evidence),
    progression,
    growthGaps: deriveGrowthGaps(progression),
    mentorship,
  };
}
