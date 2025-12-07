import type { CustodyTimelineEntry } from './log';
import { groupTimelineByDocument, listCustodyTimeline } from './log';

export type CustodyBreachType = 'duplicate_document' | 'missing_hash_link' | 'late_event_injection';

export interface CustodyBreach {
  type: CustodyBreachType;
  clinicianId: string;
  documentId: string;
  detectedAt: string;
  severity: 'low' | 'medium' | 'high';
  details: string;
}

export interface CustodyBreachQuery {
  clinicianId?: string;
  documentId?: string;
  timeline?: CustodyTimelineEntry[];
}

const LATE_EVENT_THRESHOLD_MS = 5 * 60 * 1000;

export async function detectCustodyBreaches(
  query: CustodyBreachQuery = {},
): Promise<CustodyBreach[]> {
  const timeline =
    query.timeline ??
    (await listCustodyTimeline({
      clinicianId: query.clinicianId,
      documentId: query.documentId,
      direction: 'asc',
    }));

  if (!timeline.length) return [];

  return [
    ...detectDuplicateDocuments(timeline),
    ...detectHashGaps(timeline),
    ...detectLateEventInjection(timeline),
  ];
}

function detectDuplicateDocuments(records: CustodyTimelineEntry[]): CustodyBreach[] {
  const docOwners = records.reduce<Record<string, Set<string>>>((acc, entry) => {
    if (!acc[entry.documentId]) acc[entry.documentId] = new Set();
    acc[entry.documentId].add(entry.clinicianId);
    return acc;
  }, {});

  const breaches: CustodyBreach[] = [];
  for (const [docId, owners] of Object.entries(docOwners)) {
    if (owners.size <= 1) continue;
    const details = `Document ${docId} referenced by clinicians ${Array.from(owners).join(', ')}`;
    breaches.push({
      type: 'duplicate_document',
      clinicianId: Array.from(owners)[0],
      documentId: docId,
      detectedAt: new Date().toISOString(),
      severity: 'high',
      details,
    });
  }
  return breaches;
}

function detectHashGaps(records: CustodyTimelineEntry[]): CustodyBreach[] {
  const grouped = groupTimelineByDocument(records);
  const breaches: CustodyBreach[] = [];

  for (const [documentId, events] of Object.entries(grouped)) {
    let previousHash: string | null = null;
    for (const event of events) {
      if (!previousHash) {
        previousHash = event.metadata?.hash ?? null;
        continue;
      }
      if (!event.metadata?.previousHash || event.metadata.previousHash !== previousHash) {
        breaches.push({
          type: 'missing_hash_link',
          clinicianId: event.clinicianId,
          documentId,
          detectedAt: new Date().toISOString(),
          severity: 'medium',
          details: `Event ${event.id} is missing expected hash link ${previousHash}`,
        });
      }
      previousHash = event.metadata?.hash ?? previousHash;
    }
  }

  return breaches;
}

function detectLateEventInjection(records: CustodyTimelineEntry[]): CustodyBreach[] {
  const grouped = groupTimelineByDocument(records);
  const breaches: CustodyBreach[] = [];

  for (const [documentId, events] of Object.entries(grouped)) {
    let previousTimestamp = 0;
    for (const event of events) {
      const ts = new Date(event.timestamp).getTime();
      if (previousTimestamp && previousTimestamp - ts > LATE_EVENT_THRESHOLD_MS) {
        breaches.push({
          type: 'late_event_injection',
          clinicianId: event.clinicianId,
          documentId,
          detectedAt: new Date().toISOString(),
          severity: 'medium',
          details: `Event ${event.id} timestamp ${event.timestamp} is older than prior entry by more than five minutes`,
        });
      }
      previousTimestamp = Math.max(previousTimestamp, ts);
    }
  }

  return breaches;
}










