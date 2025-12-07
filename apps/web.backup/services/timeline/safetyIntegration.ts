import type { CredentialTimelineEventType, TimelineEventSeverity } from '@prisma/client';
import type {
  PrivilegeSafetyAction,
  PrivilegeSafetySeverity,
  PrivilegeSafetySignalType,
} from '../safety/models/PrivilegeSafetySignal.js';
import { logCredentialTimelineEvent } from './logCredentialTimelineEvent.js';

const SAFETY_EVENT_TYPE = 'PRIVILEGE_SAFETY_SIGNAL' as CredentialTimelineEventType;

const SEVERITY_TO_TIMELINE: Record<PrivilegeSafetySeverity, TimelineEventSeverity> = {
  LOW: 'INFO',
  MED: 'NOTICE',
  HIGH: 'WARNING',
  CRITICAL: 'CRITICAL',
};

export interface PrivilegeSafetyTimelinePayload {
  clinicianId: string;
  signalType: PrivilegeSafetySignalType;
  severity: PrivilegeSafetySeverity;
  privilegeCodes: string[];
  summary: string;
  source?: string;
  recommendedAction?: PrivilegeSafetyAction;
  metadata?: Record<string, unknown>;
}

export async function recordPrivilegeSafetyTimelineEvent(
  payload: PrivilegeSafetyTimelinePayload
): Promise<void> {
  await logCredentialTimelineEvent({
    clinicianId: payload.clinicianId,
    eventType: SAFETY_EVENT_TYPE,
    severity: SEVERITY_TO_TIMELINE[payload.severity] ?? 'INFO',
    metadata: {
      signalType: payload.signalType,
      privilegeCodes: payload.privilegeCodes,
      summary: payload.summary,
      source: payload.source,
      recommendedAction: payload.recommendedAction,
      ...payload.metadata,
    },
  });
}

