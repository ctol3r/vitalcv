import prisma from '../../graphql/prisma_client';
import { AnchorReceipt } from '../trust-ledger/adapter';
import { Proof } from '../trust-ledger/proofs';

export const ANCHOR_EVENT_TYPE = 'ANCHOR_BATCH';

export async function findLastAnchoringEvent() {
  return prisma.auditEvent.findFirst({
    where: { type: ANCHOR_EVENT_TYPE },
    orderBy: { createdAt: 'desc' },
  });
}

export async function fetchAnchorableAuditEvents(since?: Date) {
  return prisma.auditEvent.findMany({
    where: {
      NOT: { type: ANCHOR_EVENT_TYPE },
      ...(since ? { createdAt: { gt: since } } : {}),
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function persistAnchoringEvent(params: {
  root: string;
  leafCount: number;
  adapterReceipt: AnchorReceipt;
  anchoredHashes: string[];
  windowStart: string;
  windowEnd: string;
  proofSample?: Proof[];
}) {
  const anchoredAtIso =
    params.adapterReceipt.anchoredAt && !Number.isNaN(Date.parse(params.adapterReceipt.anchoredAt))
      ? params.adapterReceipt.anchoredAt
      : new Date().toISOString();
  const createdAt = new Date(anchoredAtIso);

  return prisma.auditEvent.create({
    data: {
      type: ANCHOR_EVENT_TYPE,
      hash: params.adapterReceipt.root,
      credentialId: null,
      userId: null,
      metadata: {
        adapter: params.adapterReceipt.adapter,
        receipt: params.adapterReceipt,
        leafCount: params.leafCount,
        anchoredHashes: params.anchoredHashes,
        window: {
          start: params.windowStart,
          end: params.windowEnd,
        },
        proofSample: params.proofSample?.map((proof) => ({
          ...proof,
        })),
      },
      createdAt,
    },
  });
}
