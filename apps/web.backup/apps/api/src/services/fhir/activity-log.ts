import { randomUUID } from 'crypto';
import { ChainClient } from '../chain/client';

export type FhirActivityKind =
  | 'cds:credential-check'
  | 'cds:privilege-check'
  | 'privilege-evaluation'
  | 'bundle-fetch';

export interface FhirActivityLogInput {
  kind: FhirActivityKind;
  context: Record<string, unknown>;
  severity?: 'info' | 'warning' | 'error';
}

interface BufferedActivity extends FhirActivityLogInput {
  id: string;
  timestamp: string;
}

const buffer = new Map<string, BufferedActivity[]>();
let anchoring = false;
let lastAnchorIso = '';

export async function logFhirActivity(event: FhirActivityLogInput): Promise<void> {
  const record: BufferedActivity = {
    ...event,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };

  const dateKey = record.timestamp.slice(0, 10);
  const entries = buffer.get(dateKey) ?? [];
  entries.push(record);
  buffer.set(dateKey, entries);

  if (entries.length >= 25 || shouldAnchor(dateKey)) {
    await anchorDigest(dateKey);
  }
}

export async function flushFhirActivityDigest(): Promise<void> {
  const keys = Array.from(buffer.keys());
  await Promise.all(keys.map((key) => anchorDigest(key)));
}

function shouldAnchor(dateKey: string): boolean {
  if (!lastAnchorIso) {
    return true;
  }
  const last = Date.parse(lastAnchorIso);
  const now = Date.now();
  const elapsedHours = (now - last) / (1000 * 60 * 60);
  return elapsedHours >= 1 && dateKey <= new Date().toISOString().slice(0, 10);
}

async function anchorDigest(dateKey: string): Promise<void> {
  if (anchoring) {
    return;
  }
  const entries = buffer.get(dateKey);
  if (!entries?.length) {
    return;
  }

  anchoring = true;
  try {
    const client = new ChainClient();
    await client.submitAuditEvent({
      eventType: 'fhir-activity-digest',
      payload: {
        date: dateKey,
        totalEntries: entries.length,
        kinds: summarizeKinds(entries),
      },
      tags: ['fhir', 'cds', 'activity'],
    });
    lastAnchorIso = new Date().toISOString();
    buffer.set(dateKey, []);
  } catch (error) {
    console.warn('[FHIR] activity digest anchoring failed', error);
  } finally {
    anchoring = false;
  }
}

function summarizeKinds(entries: BufferedActivity[]) {
  const counts = new Map<FhirActivityKind, number>();
  entries.forEach((entry) => {
    counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
  });
  return Array.from(counts.entries()).map(([kind, count]) => ({ kind, count }));
}


