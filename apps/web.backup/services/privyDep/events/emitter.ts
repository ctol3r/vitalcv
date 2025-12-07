import { CredentialTimelineEventType, TimelineEventSeverity } from '@prisma/client';
import { eventBus } from '../../../backend/src/services/notifications/eventBus';
import { logCredentialTimelineEvent } from '../../timeline/logCredentialTimelineEvent';
import { mergeCredentialRisk } from '../../credentialRisk/riskService';
import { CredentialRiskFactors } from '../../credentialRisk/enums';

export type PrivilegeGraphChangeType =
  | 'PRIVILEGE_ADDED'
  | 'PRIVILEGE_REMOVED'
  | 'PRIVILEGE_ELIGIBLE'
  | 'PRIVILEGE_BLOCKED'
  | 'PRIVILEGE_CONFLICT'
  | 'PRIVILEGE_RENEWAL_IMPACT';

export interface ImpactedPrivilege {
  privilegeCode: string;
  impact: 'UNLOCKED' | 'BLOCKED' | 'REVIEW';
  reason: string;
  depth?: number;
  grantId?: string;
}

export interface EmitPrivilegeGraphChangeInput {
  clinicianId: string;
  clinicianDid?: string;
  orgId?: string;
  changeType: PrivilegeGraphChangeType;
  privilegeCode: string;
  reason: string;
  missingPrereqs?: string[];
  conflicts?: string[];
  impactedPrivileges?: ImpactedPrivilege[];
  riskFactorsToAdd?: CredentialRiskFactors[];
  riskFactorsToRemove?: CredentialRiskFactors[];
  metadata?: Record<string, unknown>;
}

const TIMELINE_EVENT_MAP: Record<PrivilegeGraphChangeType, CredentialTimelineEventType> = {
  PRIVILEGE_ADDED: CredentialTimelineEventType.PRIVILEGE_GRANTED,
  PRIVILEGE_REMOVED: CredentialTimelineEventType.DISCREPANCY_FOUND,
  PRIVILEGE_ELIGIBLE: CredentialTimelineEventType.PRIVILEGE_GRANTED,
  PRIVILEGE_BLOCKED: CredentialTimelineEventType.DISCREPANCY_FOUND,
  PRIVILEGE_CONFLICT: CredentialTimelineEventType.DISCREPANCY_FOUND,
  PRIVILEGE_RENEWAL_IMPACT: CredentialTimelineEventType.PRIVILEGE_GRANTED,
};

const TIMELINE_SEVERITY_MAP: Record<PrivilegeGraphChangeType, TimelineEventSeverity> = {
  PRIVILEGE_ADDED: TimelineEventSeverity.INFO,
  PRIVILEGE_REMOVED: TimelineEventSeverity.WARNING,
  PRIVILEGE_ELIGIBLE: TimelineEventSeverity.INFO,
  PRIVILEGE_BLOCKED: TimelineEventSeverity.WARNING,
  PRIVILEGE_CONFLICT: TimelineEventSeverity.CRITICAL,
  PRIVILEGE_RENEWAL_IMPACT: TimelineEventSeverity.NOTICE,
};

export async function emitPrivilegeGraphChange(input: EmitPrivilegeGraphChangeInput): Promise<void> {
  const payload = {
    clinicianId: input.clinicianId,
    clinicianDid: input.clinicianDid,
    orgId: input.orgId,
    changeType: input.changeType,
    privilegeCode: input.privilegeCode,
    reason: input.reason,
    missingPrereqs: input.missingPrereqs ?? [],
    conflicts: input.conflicts ?? [],
    impactedPrivileges: input.impactedPrivileges ?? [],
    metadata: input.metadata ?? {},
  };

  await eventBus.publish('PrivilegeGraphUpdated', payload);

  if ((input.riskFactorsToAdd && input.riskFactorsToAdd.length) || (input.riskFactorsToRemove && input.riskFactorsToRemove.length)) {
    await mergeCredentialRisk(input.clinicianId, {
      add: input.riskFactorsToAdd,
      remove: input.riskFactorsToRemove,
      details: input.metadata,
    });
  }

  await logCredentialTimelineEvent({
    clinicianId: input.clinicianId,
    eventType: TIMELINE_EVENT_MAP[input.changeType],
    severity: TIMELINE_SEVERITY_MAP[input.changeType],
    metadata: {
      privilegeCode: input.privilegeCode,
      reason: input.reason,
      missingPrereqs: input.missingPrereqs,
      conflicts: input.conflicts,
      impactedPrivileges: input.impactedPrivileges,
      metadata: input.metadata,
    },
  });
}

