/**
 * B163C-AN-002: Analytics event subscriber
 *
 * Subscribes to the domain EventBus and mirrors each event into the
 * AnalyticsEvent table so that downstream jobs can build rollups and charts.
 */

import {
  eventBus,
  type EventType,
  type EventPayload,
} from '../../../backend/src/services/notifications/eventBus';
import { recordAnalyticsEvent } from '../../analytics/models/AnalyticsEvent';

type AnalyticsShape = {
  subjectId?: string | null;
  orgId?: string | null;
  metadata?: Record<string, unknown>;
};

type Mapper<T extends EventType = EventType> = (payload: EventPayload<T>) => AnalyticsShape;

const EVENT_MAPPERS: Partial<Record<EventType, Mapper>> = {
  ApplicationCreated: (payload) => ({
    subjectId: payload.applicationId ?? null,
    orgId: payload.orgId ?? payload.partnerId ?? null,
    metadata: {
      jobId: payload.jobId,
      applicantDid: payload.applicantDid,
      source: payload.source,
      evidenceCount: payload.evidenceCount,
    },
  }),
  ApplicationSubmitted: (payload) => ({
    subjectId: payload.applicationId,
    orgId: payload.orgId,
    metadata: {
      jobId: payload.jobId,
      applicantDid: payload.applicantDid,
      applicantName: payload.applicantName,
      jobTitle: payload.jobTitle,
    },
  }),
  PrivilegeRequested: (payload) => ({
    subjectId: payload.privilegeRequestId,
    orgId: payload.orgId,
    metadata: {
      clinicianDid: payload.clinicianDid,
      privilegeSetId: payload.privilegeSetId,
      privilegeSetName: payload.privilegeSetName,
      clinicianName: payload.clinicianName,
    },
  }),
  PrivilegeApproved: (payload) => ({
    subjectId: payload.privilegeRequestId,
    orgId: payload.orgId,
    metadata: {
      clinicianDid: payload.clinicianDid,
      privilegeSetName: payload.privilegeSetName,
      reviewerDid: payload.reviewerDid,
      reviewNotes: payload.reviewNotes,
      status: payload.status,
    },
  }),
  PrivilegeDenied: (payload) => ({
    subjectId: payload.privilegeRequestId,
    orgId: payload.orgId,
    metadata: {
      clinicianDid: payload.clinicianDid,
      privilegeSetName: payload.privilegeSetName,
      reviewerDid: payload.reviewerDid,
      reviewNotes: payload.reviewNotes,
      status: payload.status,
    },
  }),
  PayerEnrollmentSubmitted: (payload) => ({
    subjectId: payload.enrollmentId,
    orgId: payload.orgId ?? null,
    metadata: {
      payerId: payload.payerId,
      clinicianDid: payload.clinicianDid,
      submittedAt: payload.submittedAt,
    },
  }),
  PayerSubmitted: (payload) => ({
    subjectId: payload.enrollmentId,
    orgId: payload.orgId ?? null,
    metadata: {
      payerId: payload.payerId,
      payerName: payload.payerName,
      clinicianDid: payload.clinicianDid,
      notificationUserId: payload.notificationUserId,
    },
  }),
  PsvCompleted: (payload) => ({
    subjectId: payload.psvResultId,
    orgId: payload.orgId ?? null,
    metadata: {
      clinicianId: payload.clinicianId,
      clinicianDid: payload.clinicianDid,
      passed: payload.passed,
      hasSanctions: payload.hasSanctions,
      isFresh: payload.isFresh,
      summary: payload.summary,
    },
  }),
  PSVCompleted: (payload) => ({
    subjectId: payload.clinicianId,
    orgId: payload.orgId ?? null,
    metadata: {
      clinicianDid: payload.clinicianDid,
      notificationUserId: payload.notificationUserId,
      passed: payload.passed,
      hasSanctions: payload.hasSanctions,
      isFresh: payload.isFresh,
      status: payload.status,
      summary: payload.summary,
    },
  }),
};

let initialized = false;

function registerAnalyticsSubscriber(): void {
  if (initialized) {
    return;
  }

  (Object.entries(EVENT_MAPPERS) as Array<[EventType, Mapper]>).forEach(([eventType, mapper]) => {
    if (!mapper) {
      return;
    }

    eventBus.onEvent(eventType, async (payload) => {
      try {
        const { subjectId, orgId, metadata } = mapper(payload);
        await recordAnalyticsEvent({
          eventType,
          subjectId: subjectId ?? undefined,
          orgId: orgId ?? undefined,
          metadata,
        });
      } catch (error) {
        console.error(`[AnalyticsEventSubscriber] Failed to record ${eventType}:`, error);
      }
    });
  });

  initialized = true;
  console.log('[AnalyticsEventSubscriber] Registered analytics event recorder');
}

registerAnalyticsSubscriber();

export default registerAnalyticsSubscriber;
/**
 * B163C-AN-002: Analytics event subscriber
 *
 * Subscribes to the domain EventBus and mirrors each event into the
 * AnalyticsEvent table so that downstream jobs can build rollups and charts.
 */

import { eventBus, EventType, EventPayload } from '../../../backend/src/services/notifications/eventBus';
import { recordAnalyticsEvent } from '../../analytics/models/AnalyticsEvent';

type AnalyticsShape = {
  subjectId?: string | null;
  orgId?: string | null;
  metadata?: Record<string, unknown>;
};

type Mapper = (payload: EventPayload) => AnalyticsShape;

const EVENT_MAPPERS: Record<EventType, Mapper> = {
  ApplicationCreated: (payload) => ({
    subjectId: payload.applicationId ?? payload.id ?? null,
    orgId: payload.orgId ?? payload.partnerId ?? null,
    metadata: {
      jobId: payload.jobId,
      applicantDid: payload.applicantDid,
      source: payload.source,
    },
  }),
  PrivilegeRequested: (payload) => ({
    subjectId: payload.privilegeRequestId ?? null,
    orgId: payload.orgId ?? null,
    metadata: {
      clinicianDid: payload.clinicianDid,
      privilegeSetId: payload.privilegeSetId,
    },
  }),
  PrivilegeApproved: (payload) => ({
    subjectId: payload.privilegeRequestId ?? null,
    orgId: payload.orgId ?? null,
    metadata: {
      clinicianDid: payload.clinicianDid,
      privilegeSetName: payload.privilegeSetName,
    },
  }),
  PrivilegeDenied: (payload) => ({
    subjectId: payload.privilegeRequestId ?? null,
    orgId: payload.orgId ?? null,
    metadata: {
      clinicianDid: payload.clinicianDid,
      privilegeSetName: payload.privilegeSetName,
      reason: payload.reason,
    },
  }),
  PayerEnrollmentSubmitted: (payload) => ({
    subjectId: payload.enrollmentId ?? payload.id ?? null,
    orgId: payload.orgId ?? null,
    metadata: {
      payerId: payload.payerId,
      clinicianDid: payload.clinicianDid,
      submittedAt: payload.submittedAt,
    },
  }),
  PsvCompleted: (payload) => ({
    subjectId: payload.psvResultId ?? payload.id ?? null,
    orgId: payload.orgId ?? null,
    metadata: {
      clinicianId: payload.clinicianId,
      clinicianDid: payload.clinicianDid,
      passed: payload.passed,
      hasSanctions: payload.hasSanctions,
      isFresh: payload.isFresh,
    },
  }),
};

let initialized = false;

function registerAnalyticsSubscriber(): void {
  if (initialized) {
    return;
  }

  (Object.keys(EVENT_MAPPERS) as EventType[]).forEach((eventType) => {
    const mapper = EVENT_MAPPERS[eventType];

    eventBus.onEvent(eventType, async (payload) => {
      try {
        const { subjectId, orgId, metadata } = mapper(payload);
        await recordAnalyticsEvent({
          eventType,
          subjectId: subjectId ?? undefined,
          orgId: orgId ?? undefined,
          metadata,
        });
      } catch (error) {
        console.error(`[AnalyticsEventSubscriber] Failed to record ${eventType}:`, error);
      }
    });
  });

  initialized = true;
  console.log('[AnalyticsEventSubscriber] Registered analytics event recorder');
}

registerAnalyticsSubscriber();

export default registerAnalyticsSubscriber;

