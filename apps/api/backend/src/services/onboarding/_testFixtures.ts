/**
 * _testFixtures.ts — W2-PR167A shared test helpers.
 * Only imported by test files; never shipped in production.
 */

import type { ActivationSignal, ConvergenceEntity, ConvergenceRole, MilestoneStatus } from './onboardingConvergence';
import type { ActivationLineageRef, ReplayActivationInputs } from './replaySafeActivation';

const BASE_MS = Date.parse('2026-01-01T00:00:00.000Z');
const MS_PER_DAY = 86_400_000;

function isoOffset(days: number): string {
  return new Date(BASE_MS + days * MS_PER_DAY).toISOString();
}

export function makeSignal(overrides: Partial<ActivationSignal> & Pick<ActivationSignal, 'signalId' | 'entityId' | 'milestoneId'>): ActivationSignal {
  return {
    schema: 'vitalcv.activation-signal.v1',
    observedAt: isoOffset(0),
    role: 'ISSUER',
    milestoneStatus: 'COMPLETED',
    sourceAuditLineageId: `lineage-${overrides.signalId}`,
    orgId: 'org-default',
    ...overrides,
  };
}

export function makeEntity(entityId: string, role: ConvergenceRole = 'ISSUER', orgId = 'org-default'): ConvergenceEntity {
  return {
    entityId,
    role,
    orgId,
    enrolledAt: isoOffset(0),
  };
}

export function makeLineageRef(lineageId: string, digest?: string): ActivationLineageRef {
  return {
    lineageId,
    lineageDigestAtIssue: digest ?? `digest-${lineageId}`,
  };
}

export function makeReplayInput(
  overrides: Partial<ReplayActivationInputs> & Pick<ReplayActivationInputs, 'entityId' | 'milestoneId'>,
): ReplayActivationInputs {
  return {
    role: 'ISSUER',
    milestoneStatus: 'COMPLETED',
    orgId: 'org-default',
    observedAt: isoOffset(0),
    lineageRef: makeLineageRef(`lineage-${overrides.entityId}-${overrides.milestoneId}`),
    ...overrides,
  };
}

/** Build N signals for one entity across sequential milestones. */
export function makeEntitySignals(
  entityId: string,
  milestoneIds: string[],
  role: ConvergenceRole,
  orgId: string,
  statusOverride?: MilestoneStatus,
  dayOffset = 0,
): ActivationSignal[] {
  return milestoneIds.map((milestoneId, i) =>
    makeSignal({
      signalId: `${entityId}-${milestoneId}`,
      entityId,
      milestoneId,
      role,
      orgId,
      milestoneStatus: statusOverride ?? 'COMPLETED',
      observedAt: isoOffset(dayOffset + i),
    }),
  );
}

/** Build a fleet of entity signals across multiple orgs for harmonization tests. */
export function makeMultiOrgSignals(
  entityId: string,
  milestoneId: string,
  orgStatuses: Array<{ orgId: string; status: MilestoneStatus }>,
  role: ConvergenceRole = 'ISSUER',
): ActivationSignal[] {
  return orgStatuses.map(({ orgId, status }) =>
    makeSignal({
      signalId: `${entityId}-${milestoneId}-${orgId}`,
      entityId,
      milestoneId,
      role,
      orgId,
      milestoneStatus: status,
    }),
  );
}
