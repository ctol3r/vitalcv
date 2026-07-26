/**
 * Career Intelligence (Wave 320).
 *
 * Pure, DETERMINISTIC, EXPLAINABLE derivation over the evidence / trust / timeline
 * / mobility / organization projections. No ML, no opaque scoring. Every insight
 * carries a `basis` (the evidenceIds / dimensions / sources it derives from) and
 * every action a `rationale` — so any output can be verified by hand.
 *
 * Three services: insight generation (C1), a notification engine (C2), and action
 * prioritization (C3). All are functions of the inputs only (no Date.now, no I/O).
 */

import type { EvidenceCollection } from '../types';
import type { TrustDimension, TrustProjection } from '../trust/propagate';
import type { TimelineProjection } from '../timeline/timeline';
import type { MobilityOverview } from '../mobility/mobility';
import type { OrganizationGraph } from '../organizations/organizations';

// ── C1: Insights ─────────────────────────────────────────────────────────────

export type InsightKind = 'strength' | 'gap' | 'risk' | 'opportunity';
export type InsightSeverity = 'high' | 'medium' | 'low' | 'info';

export interface Insight {
  id: string;
  kind: InsightKind;
  title: string;
  detail: string;
  severity: InsightSeverity;
  dimension: TrustDimension | null;
  /** Explainability — the data this insight derives from. */
  basis: string[];
}

// ── C2: Notifications ────────────────────────────────────────────────────────

export type NotificationCategory = 'decay' | 'gap' | 'opportunity' | 'review';

export interface Notification {
  id: string;
  severity: 'high' | 'medium' | 'low';
  category: NotificationCategory;
  title: string;
  detail: string;
  occurredAt: string | null;
}

// ── C3: Prioritized actions ──────────────────────────────────────────────────

export interface PrioritizedAction {
  id: string;
  rank: number;
  priority: 'high' | 'medium' | 'low';
  title: string;
  rationale: string;
  relatedInsightIds: string[];
}

export interface IntelligenceProjection {
  subjectKey: string;
  insights: Insight[];
  notifications: Notification[];
  actions: PrioritizedAction[];
  summary: { strengths: number; gaps: number; risks: number; opportunities: number };
}

// ── Insight generation ───────────────────────────────────────────────────────

function generateInsights(
  evidence: EvidenceCollection,
  trust: TrustProjection,
  timeline: TimelineProjection,
  mobility: MobilityOverview,
): Insight[] {
  const insights: Insight[] = [];

  // Strengths: decision-grade-strong trust dimensions.
  for (const d of trust.dimensions) {
    if (d.score !== null && d.score >= 0.67) {
      insights.push({
        id: `strength:${d.dimension}`,
        kind: 'strength',
        title: `Strong ${d.dimension}`,
        detail: `${d.dimension} is source-backed (score ${d.score}) by ${d.decisionGradeCount} decision-grade item(s).`,
        severity: 'info',
        dimension: d.dimension,
        basis: d.supporting,
      });
    }
  }

  // Gaps: dimensions with no evidence at all (honest null).
  for (const d of trust.dimensions) {
    if (d.score === null) {
      insights.push({
        id: `gap:${d.dimension}`,
        kind: 'gap',
        title: `No ${d.dimension} evidence`,
        detail: `No source-backed ${d.dimension} evidence on file.`,
        severity: 'medium',
        dimension: d.dimension,
        basis: [],
      });
    }
  }

  // Gaps: owed coverage (gated / not-decision-grade sources).
  const owed = [...evidence.coverageSummary.gated, ...evidence.coverageSummary.accessRequired, ...evidence.coverageSummary.notDecisionGrade];
  for (const sourceId of owed) {
    insights.push({
      id: `gap:source:${sourceId}`,
      kind: 'gap',
      title: `Evidence owed: ${sourceId}`,
      detail: `${sourceId} is present but not decision-grade (gated / access required).`,
      severity: 'medium',
      dimension: null,
      basis: [sourceId],
    });
  }

  // Risks: decay events from the trust history.
  for (const entry of timeline.trustHistory.entries) {
    if (entry.type === 'decay') {
      insights.push({
        id: `risk:${entry.evidenceId ?? entry.dimension ?? 'decay'}`,
        kind: 'risk',
        title: 'Trust decay',
        detail: entry.detail,
        severity: 'high',
        dimension: entry.dimension,
        basis: entry.evidenceId ? [entry.evidenceId] : [],
      });
    }
  }

  // Opportunities: reusable evidence + mobility breadth.
  if (mobility.reusableEvidenceCount > 0) {
    insights.push({
      id: 'opportunity:reusable',
      kind: 'opportunity',
      title: `${mobility.reusableEvidenceCount} reusable evidence item(s)`,
      detail: 'Decision-grade evidence can be reused across new opportunities without re-verification.',
      severity: 'low',
      dimension: null,
      basis: evidence.objects.filter((o) => o.decisionGrade).map((o) => o.evidenceId),
    });
  }
  if (mobility.licensedStates.length > 0) {
    insights.push({
      id: 'opportunity:mobility',
      kind: 'opportunity',
      title: `Licensed in ${mobility.licensedStates.join(', ')}`,
      detail: 'Source-backed licensure supports placement in these states; compact endorsement may extend reach.',
      severity: 'low',
      dimension: 'mobility',
      basis: mobility.licensedStates,
    });
  }

  // Deterministic order: by kind weight then id.
  const kindWeight: Record<InsightKind, number> = { risk: 0, gap: 1, opportunity: 2, strength: 3 };
  insights.sort((a, b) => (kindWeight[a.kind] - kindWeight[b.kind]) || a.id.localeCompare(b.id));
  return insights;
}

// ── Notification engine ──────────────────────────────────────────────────────

function generateNotifications(insights: Insight[], timeline: TimelineProjection): Notification[] {
  const decayAt = new Map<string, string | null>();
  for (const e of timeline.trustHistory.entries) {
    if (e.type === 'decay' && e.evidenceId) decayAt.set(e.evidenceId, e.occurredAt);
  }

  const notifications: Notification[] = [];
  for (const i of insights) {
    if (i.kind === 'risk') {
      notifications.push({ id: `notify:${i.id}`, severity: 'high', category: 'decay', title: i.title, detail: i.detail, occurredAt: i.basis[0] ? decayAt.get(i.basis[0]) ?? null : null });
    } else if (i.kind === 'gap') {
      notifications.push({ id: `notify:${i.id}`, severity: 'medium', category: 'gap', title: i.title, detail: i.detail, occurredAt: null });
    } else if (i.kind === 'opportunity') {
      notifications.push({ id: `notify:${i.id}`, severity: 'low', category: 'opportunity', title: i.title, detail: i.detail, occurredAt: null });
    }
  }
  // strengths are informational, not notifications. Deterministic: severity then id.
  const sevWeight = { high: 0, medium: 1, low: 2 } as const;
  notifications.sort((a, b) => (sevWeight[a.severity] - sevWeight[b.severity]) || a.id.localeCompare(b.id));
  return notifications;
}

// ── Action prioritization ────────────────────────────────────────────────────

function prioritizeActions(insights: Insight[]): PrioritizedAction[] {
  const actions: Omit<PrioritizedAction, 'rank'>[] = [];

  for (const i of insights) {
    if (i.kind === 'risk') {
      actions.push({ id: `action:${i.id}`, priority: 'high', title: `Refresh: ${i.detail}`, rationale: `Resolves a trust-decay risk (${i.dimension ?? 'evidence'}).`, relatedInsightIds: [i.id] });
    } else if (i.kind === 'gap') {
      actions.push({ id: `action:${i.id}`, priority: 'medium', title: `Add evidence: ${i.title}`, rationale: `Closes a coverage gap in ${i.dimension ?? 'source coverage'}.`, relatedInsightIds: [i.id] });
    } else if (i.kind === 'opportunity') {
      actions.push({ id: `action:${i.id}`, priority: 'low', title: `Leverage: ${i.title}`, rationale: 'Reusable, source-backed evidence advances new opportunities.', relatedInsightIds: [i.id] });
    }
  }

  const prWeight = { high: 0, medium: 1, low: 2 } as const;
  actions.sort((a, b) => (prWeight[a.priority] - prWeight[b.priority]) || a.id.localeCompare(b.id));
  return actions.map((a, idx) => ({ ...a, rank: idx + 1 }));
}

// ── Top-level ────────────────────────────────────────────────────────────────

export function generateIntelligence(
  evidence: EvidenceCollection,
  trust: TrustProjection,
  timeline: TimelineProjection,
  mobility: MobilityOverview,
  _organizations: OrganizationGraph,
): IntelligenceProjection {
  const insights = generateInsights(evidence, trust, timeline, mobility);
  return {
    subjectKey: evidence.subjectKey,
    insights,
    notifications: generateNotifications(insights, timeline),
    actions: prioritizeActions(insights),
    summary: {
      strengths: insights.filter((i) => i.kind === 'strength').length,
      gaps: insights.filter((i) => i.kind === 'gap').length,
      risks: insights.filter((i) => i.kind === 'risk').length,
      opportunities: insights.filter((i) => i.kind === 'opportunity').length,
    },
  };
}
