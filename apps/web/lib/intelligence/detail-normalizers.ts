import type { ActionDetailResponse, InvestigatorFindingDetailResponse } from './detail-types';
import { normalizeActionStatus, normalizeFindingStatus } from './contracts';

export function normalizeFindingDetailResponse(
  payload: InvestigatorFindingDetailResponse,
): InvestigatorFindingDetailResponse {
  return {
    ...payload,
    finding: {
      ...payload.finding,
      status: normalizeFindingStatus(payload.finding.status),
      statusEvents: payload.finding.statusEvents.map((event) => ({
        ...event,
        fromStatus: event.fromStatus ? normalizeFindingStatus(event.fromStatus) : null,
        toStatus: normalizeFindingStatus(event.toStatus),
      })),
    },
  };
}

export function normalizeActionDetailResponse(
  payload: ActionDetailResponse,
): ActionDetailResponse {
  return {
    ...payload,
    action: {
      ...payload.action,
      status: normalizeActionStatus(payload.action.status),
      statusEvents: payload.action.statusEvents?.map((event) => ({
        ...event,
        fromStatus: event.fromStatus ? normalizeActionStatus(event.fromStatus) : null,
        toStatus: normalizeActionStatus(event.toStatus),
      })),
    },
  };
}
