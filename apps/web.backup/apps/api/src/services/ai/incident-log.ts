import { randomUUID } from 'crypto';

export type AiIncidentType = 'unexpected_weights' | 'hallucinated_fields' | 'chain_mismatch';
export type AiIncidentSeverity = 'low' | 'medium' | 'high';

export interface AiIncidentRecord {
  id: string;
  event: AiIncidentType;
  detail: string;
  severity: AiIncidentSeverity;
  decision?: string;
  context?: Record<string, unknown>;
  detectedAt: string;
}

const MAX_INCIDENTS = 250;
const incidentLedger: AiIncidentRecord[] = [];

export function recordAiIncident(input: {
  event: AiIncidentType;
  detail: string;
  decision?: string;
  context?: Record<string, unknown>;
  severity?: AiIncidentSeverity;
  detectedAt?: string;
}): AiIncidentRecord {
  const record: AiIncidentRecord = {
    id: randomUUID(),
    event: input.event,
    detail: input.detail,
    decision: input.decision,
    context: input.context ?? {},
    severity: input.severity ?? 'low',
    detectedAt: input.detectedAt ?? new Date().toISOString(),
  };

  incidentLedger.unshift(record);
  if (incidentLedger.length > MAX_INCIDENTS) {
    incidentLedger.pop();
  }

  return record;
}

export function listAiIncidents(filter: { event?: AiIncidentType; limit?: number } = {}): AiIncidentRecord[] {
  const filtered = incidentLedger.filter((record) => {
    if (filter.event && record.event !== filter.event) {
      return false;
    }
    return true;
  });

  if (filter.limit && filter.limit > 0) {
    return filtered.slice(0, filter.limit);
  }

  return filtered;
}










