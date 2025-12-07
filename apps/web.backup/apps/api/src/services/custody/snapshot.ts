import type { ChainReceipt, AuditScrapbookRecord } from '../chain/client';
import { ChainClient } from '../chain/client';
import type { CustodyTimelineEntry } from './log';
import { listCustodyTimeline } from './log';
import { stitchCustodyBlock } from './stitch';

export interface CustodySnapshotAnchorInput {
  clinicianId: string;
  documentId?: string;
  timeline?: CustodyTimelineEntry[];
  metadata?: Record<string, unknown>;
  chainClient?: ChainClient;
}

export interface CustodySnapshotAnchorResult {
  custodyRoot: string;
  entryCount: number;
  receipt: ChainReceipt;
}

export async function anchorCustodySnapshot(
  input: CustodySnapshotAnchorInput,
): Promise<CustodySnapshotAnchorResult> {
  const timeline =
    input.timeline ??
    (await listCustodyTimeline({
      clinicianId: input.clinicianId,
      documentId: input.documentId,
      direction: 'asc',
    }));

  if (!timeline.length) {
    throw new Error('Cannot anchor custody snapshot without custody events');
  }

  const block = stitchCustodyBlock(timeline);
  const client = input.chainClient ?? new ChainClient();

  const payload: AuditScrapbookRecord = {
    eventType: 'CUSTODY_SNAPSHOT',
    correlationId: `${input.clinicianId}:${input.documentId ?? 'all'}`,
    tags: ['custody', 'chain', 'compliance'],
    payload: {
      clinicianId: input.clinicianId,
      documentId: input.documentId ?? null,
      custodyRoot: block.custodyRoot,
      entryCount: block.entryCount,
      firstEventAt: block.firstEventAt,
      lastEventAt: block.lastEventAt,
      metadata: input.metadata ?? {},
      generatedAt: new Date().toISOString(),
    },
  };

  const receipt = await client.submitAuditEvent(payload);

  return {
    custodyRoot: block.custodyRoot,
    entryCount: block.entryCount,
    receipt,
  };
}










