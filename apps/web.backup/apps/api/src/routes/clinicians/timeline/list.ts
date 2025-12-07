import { Router, Request, Response } from 'express';
import {
  loadUserSession,
  requireAuth,
  AuthenticatedRequest,
} from '../../../../../../backend/src/middleware/accessGuards';
import {
  buildClinicianTimeline,
  getTimelineSummary,
  loadClinicianWithUser,
} from '../../../../../../services/timeline/getClinicianTimeline';
import {
  SortDirection,
  TimelineEvent,
  TimelinePhaseGroup,
  TIMELINE_PHASE_LABELS,
} from '../../../../../../services/timeline/types';
import { canAccessTimeline } from './access';

const router = Router();
router.use(loadUserSession, requireAuth);

router.get('/:clinicianId/timeline', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    if (!clinicianId) {
      return res.status(400).json({
        success: false,
        error: 'clinician_id_required',
      });
    }

    const { sortDirection, startDate, endDate, error } = parseQuery(req);
    if (error) {
      return res.status(400).json({
        success: false,
        error,
      });
    }

    const clinician = await loadClinicianWithUser(clinicianId);
    if (!clinician) {
      return res.status(404).json({
        success: false,
        error: 'clinician_not_found',
      });
    }

    const authReq = req as AuthenticatedRequest;
    if (!canAccessTimeline(authReq.user, clinician.userId)) {
      return res.status(403).json({
        success: false,
        error: 'forbidden',
        message: 'Only the clinician or an authorized admin can view this timeline.',
      });
    }

    const timeline = await buildClinicianTimeline({
      clinician,
      sortDirection,
      startDate,
      endDate,
    });

    const serializedEvents = timeline.events.map(serializeTimelineEvent);
    const serializedPhases = timeline.phaseGroups.map(serializeTimelinePhaseGroup);

    return res.status(200).json({
      success: true,
      clinicianId: clinician.id,
      npi: clinician.npi,
      filters: {
        sort: sortDirection,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
      },
      count: serializedEvents.length,
      events: serializedEvents,
      phases: serializedPhases,
    });
  } catch (error) {
    console.error('Failed to load clinician timeline', error);
    return res.status(500).json({
      success: false,
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

function parseQuery(req: Request) {
  const sortParam = (pickFirst(req.query.sort) ?? 'desc').toLowerCase();
  const sortDirection: SortDirection = sortParam === 'asc' ? 'asc' : 'desc';

  let startDate: Date | undefined;
  const startValue = pickFirst(req.query.startDate);
  if (startValue) {
    const parsed = new Date(startValue);
    if (Number.isNaN(parsed.getTime())) {
      return { error: 'invalid_start_date' as const, sortDirection };
    }
    startDate = parsed;
  }

  let endDate: Date | undefined;
  const endValue = pickFirst(req.query.endDate);
  if (endValue) {
    const parsed = new Date(endValue);
    if (Number.isNaN(parsed.getTime())) {
      return { error: 'invalid_end_date' as const, sortDirection };
    }
    endDate = parsed;
  }

  if (startDate && endDate && startDate > endDate) {
    return { error: 'invalid_date_range' as const, sortDirection };
  }

  return { sortDirection, startDate, endDate };
}

function pickFirst(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return value[0]?.toString();
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value === undefined || value === null) {
    return undefined;
  }
  return value.toString();
}

function serializeTimelineEvent(event: TimelineEvent) {
  return {
    id: event.id,
    phase: event.phase,
    phaseLabel: TIMELINE_PHASE_LABELS[event.phase],
    type: event.type,
    title: event.title,
    timestamp: event.timestamp.toISOString(),
    status: event.status,
    source: event.source,
    summary: event.summary,
    metadata: event.metadata,
    actor: event.actor,
    sensitive: event.sensitive ?? false,
  };
}

function serializeTimelinePhaseGroup(group: TimelinePhaseGroup) {
  return {
    phase: group.phase,
    phaseLabel: TIMELINE_PHASE_LABELS[group.phase],
    events: group.events.map(serializeTimelineEvent),
  };
}

export default router;


