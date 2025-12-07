const log = getServiceLogger('events/subscribers/analyticsEventSubscriber');
/**
 * B163C-AN-002: Analytics event subscriber
 *
 * Subscribes to the domain EventBus and mirrors each event into the
 * AnalyticsEvent table so that downstream jobs can build rollups and charts.
 */

import { eventBus, EventType, EventPayload } from '../../../backend/src/services/notifications/eventBus';
import { recordAnalyticsEvent } from '../../analytics/models/AnalyticsEvent';
import { getServiceLogger } from '../../logging/serviceLogger';

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
  PSVCompleted: (payload) => ({
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
        log.error(`[AnalyticsEventSubscriber] Failed to record ${eventType}:`, error);
      }
    });
  });

  initialized = true;
  log.info('[AnalyticsEventSubscriber] Registered analytics event recorder');
}

registerAnalyticsSubscriber();

export default registerAnalyticsSubscriber;

