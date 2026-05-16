/**
 * crossOrgHarmonization.ts — W2-PR167A
 *
 * Cross-Org Onboarding Harmonization Engine.
 *
 * When the same entity (entityId) is onboarded across multiple organizations,
 * their milestone states must agree before a shared decision can be made.
 * This engine detects agreement, disagreement, and ambiguity without silently
 * collapsing contradictions.
 *
 * Hard invariants:
 *
 *   1. ambiguity preserved — if org-A says milestone M is COMPLETED and
 *      org-B says BLOCKED, both states are retained in the report as
 *      ORG_DISAGREEMENT. No automatic resolution.
 *   2. harmonization is not reconciliation — this engine reports the state;
 *      it does not change records. Callers decide how to proceed.
 *   3. cross-org readiness score (0-100) counts only entities with full
 *      inter-org agreement across all milestones. A single disagreement
 *      drops the entity out of the "ready" pool.
 *   4. empty entity set → crossOrgReadinessScore = 0.
 *   5. lineageDigest is deterministic over all input orgEntityKeys and
 *      their states, enabling regulator reconstruction.
 *
 * Pure transform — no fetches, no DB writes.
 */

import { sha256ForPayload } from '../../utils/deterministic';
import type { ActivationSignal, ConvergenceRole, MilestoneStatus } from './onboardingConvergence';

// ── Types ─────────────────────────────────────────────────────────────────────

export type HarmonizationVerdict =
  | 'HARMONIZED'
  | 'PARTIAL_HARMONY'
  | 'DISHARMONY'
  | 'HARMONY_AMBIGUOUS';

export interface OrgMilestoneState {
  orgId: string;
  milestoneId: string;
  milestoneStatus: MilestoneStatus;
  signalId: string;
  observedAt: string;
}

export interface EntityHarmonizationState {
  entityId: string;
  role: ConvergenceRole;
  orgsPresent: string[];
  milestonesChecked: string[];
  agreementCount: number;
  disagreementCount: number;
  /** Per-milestone breakdown of org states. */
  milestoneAgreements: MilestoneAgreement[];
  entityHarmonized: boolean;
}

export interface MilestoneAgreement {
  milestoneId: string;
  agreed: boolean;
  orgStates: OrgMilestoneState[];
  /** Non-empty when orgs disagree. Contains orgId pairs with different statuses. */
  conflicts: OrgDisagreement[];
}

export interface OrgDisagreement {
  orgA: string;
  orgB: string;
  statusA: MilestoneStatus;
  statusB: MilestoneStatus;
  reason: string;
}

export interface CrossOrgHarmonizationInputs {
  signals: ActivationSignal[];
  sliceWindowIso: string;
}

export interface CrossOrgHarmonizationReport {
  schema: 'vitalcv.cross-org-harmonization-report.v1';
  verdict: HarmonizationVerdict;
  entityStates: EntityHarmonizationState[];
  crossOrgReadinessScore: number; // 0-100
  harmonizedEntityCount: number;
  totalEntityCount: number;
  totalDisagreements: number;
  harmonizationDigest: string;
  computedAt: string;
  sliceWindowIso: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function detectMilestoneConflicts(orgStates: OrgMilestoneState[]): OrgDisagreement[] {
  const conflicts: OrgDisagreement[] = [];
  for (let i = 0; i < orgStates.length; i++) {
    for (let j = i + 1; j < orgStates.length; j++) {
      const a = orgStates[i];
      const b = orgStates[j];
      if (a.milestoneStatus !== b.milestoneStatus) {
        conflicts.push({
          orgA: a.orgId,
          orgB: b.orgId,
          statusA: a.milestoneStatus,
          statusB: b.milestoneStatus,
          reason: `Milestone ${a.milestoneId}: org ${a.orgId} reports ${a.milestoneStatus}, org ${b.orgId} reports ${b.milestoneStatus}`,
        });
      }
    }
  }
  return conflicts;
}

function buildEntityHarmonizationState(
  entityId: string,
  role: ConvergenceRole,
  signals: ActivationSignal[],
): EntityHarmonizationState {
  const orgsPresent = [...new Set(signals.map((s) => s.orgId))];
  const milestoneIds = [...new Set(signals.map((s) => s.milestoneId))];

  const milestoneAgreements: MilestoneAgreement[] = [];
  let agreementCount = 0;
  let disagreementCount = 0;

  for (const milestoneId of milestoneIds) {
    const milestoneSignals = signals.filter((s) => s.milestoneId === milestoneId);

    // One signal per org — take the latest if duplicates
    const latestByOrg = new Map<string, ActivationSignal>();
    for (const signal of milestoneSignals) {
      const existing = latestByOrg.get(signal.orgId);
      if (!existing || signal.observedAt > existing.observedAt) {
        latestByOrg.set(signal.orgId, signal);
      }
    }

    const orgStates: OrgMilestoneState[] = [...latestByOrg.values()].map((s) => ({
      orgId: s.orgId,
      milestoneId: s.milestoneId,
      milestoneStatus: s.milestoneStatus,
      signalId: s.signalId,
      observedAt: s.observedAt,
    }));

    const conflicts = detectMilestoneConflicts(orgStates);
    const agreed = conflicts.length === 0 && orgStates.length > 0;

    if (agreed) {
      agreementCount++;
    } else {
      disagreementCount++;
    }

    milestoneAgreements.push({
      milestoneId,
      agreed,
      orgStates,
      conflicts,
    });
  }

  return {
    entityId,
    role,
    orgsPresent,
    milestonesChecked: milestoneIds,
    agreementCount,
    disagreementCount,
    milestoneAgreements,
    entityHarmonized: disagreementCount === 0 && agreementCount > 0,
  };
}

function computeHarmonizationDigest(inputs: CrossOrgHarmonizationInputs): string {
  return sha256ForPayload({
    sliceWindowIso: inputs.sliceWindowIso,
    entityKeys: [
      ...new Set(inputs.signals.map((s) => `${s.entityId}::${s.orgId}::${s.milestoneId}::${s.milestoneStatus}`)),
    ].sort(),
  });
}

function deriveVerdict(
  harmonizedCount: number,
  totalCount: number,
  totalDisagreements: number,
): HarmonizationVerdict {
  if (totalCount === 0) return 'HARMONY_AMBIGUOUS';
  if (totalDisagreements > 0 && harmonizedCount === 0) return 'DISHARMONY';
  if (totalDisagreements > 0) return 'PARTIAL_HARMONY';
  return 'HARMONIZED';
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildCrossOrgHarmonizationReport(
  inputs: CrossOrgHarmonizationInputs,
): CrossOrgHarmonizationReport {
  const { signals } = inputs;

  // Group signals by entityId
  const byEntity = new Map<string, ActivationSignal[]>();
  for (const signal of signals) {
    const bucket = byEntity.get(signal.entityId);
    if (bucket) {
      bucket.push(signal);
    } else {
      byEntity.set(signal.entityId, [signal]);
    }
  }

  const entityStates: EntityHarmonizationState[] = [];
  let harmonizedCount = 0;
  let totalDisagreements = 0;

  for (const [entityId, entitySignals] of byEntity) {
    const role = entitySignals[0].role;
    const state = buildEntityHarmonizationState(entityId, role, entitySignals);
    entityStates.push(state);
    if (state.entityHarmonized) harmonizedCount++;
    totalDisagreements += state.disagreementCount;
  }

  const totalCount = entityStates.length;
  const crossOrgReadinessScore =
    totalCount === 0 ? 0 : Math.round((harmonizedCount / totalCount) * 100);

  const verdict = deriveVerdict(harmonizedCount, totalCount, totalDisagreements);
  const harmonizationDigest = computeHarmonizationDigest(inputs);

  return {
    schema: 'vitalcv.cross-org-harmonization-report.v1',
    verdict,
    entityStates,
    crossOrgReadinessScore,
    harmonizedEntityCount: harmonizedCount,
    totalEntityCount: totalCount,
    totalDisagreements,
    harmonizationDigest,
    computedAt: new Date().toISOString(),
    sliceWindowIso: inputs.sliceWindowIso,
  };
}
