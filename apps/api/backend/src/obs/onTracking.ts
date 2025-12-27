import prisma from '../graphql/prisma_client';

type AuditWriter = (event: {
  type: string;
  credentialId?: string;
  userId?: number;
  metadata?: any;
}) => Promise<{ hash: string; createdAt: string }>;

type AuditSnapshot = {
  hash: string;
  createdAt: Date;
};

type OnChainState = {
  issued?: AuditSnapshot;
  wallet?: AuditSnapshot;
  verified?: AuditSnapshot;
};

const REQUIRED_ON_CHAIN = ['ISSUE_CREDENTIAL', 'WALLET_STORED', 'VERIFY_PRESENTATION'] as const;

type OnChainEventType = (typeof REQUIRED_ON_CHAIN)[number];

function mapOnChainEvents(events: Array<{ type: string; hash: string; createdAt: Date }>): {
  state: OnChainState;
  missing: OnChainEventType[];
} {
  const state: OnChainState = {};
  for (const event of events) {
    if (event.type === 'ISSUE_CREDENTIAL') {
      state.issued = { hash: event.hash, createdAt: event.createdAt };
    }
    if (event.type === 'WALLET_STORED') {
      state.wallet = { hash: event.hash, createdAt: event.createdAt };
    }
    if (event.type === 'VERIFY_PRESENTATION') {
      state.verified = { hash: event.hash, createdAt: event.createdAt };
    }
  }

  const missing = REQUIRED_ON_CHAIN.filter((type) => {
    if (type === 'ISSUE_CREDENTIAL') return !state.issued;
    if (type === 'WALLET_STORED') return !state.wallet;
    if (type === 'VERIFY_PRESENTATION') return !state.verified;
    return false;
  });

  return { state, missing };
}

export async function maybeEmitOnCompleteEvent(params: {
  credentialId: string | null | undefined;
  applicationId: number;
  verifierId?: string | null;
  writeAuditEvent: AuditWriter;
}): Promise<{
  emitted: boolean;
  missing: OnChainEventType[];
  auditRef?: string;
  chain?: OnChainState;
  reason?: string;
}> {
  const credentialId = params.credentialId?.trim();
  if (!credentialId) {
    return { emitted: false, missing: REQUIRED_ON_CHAIN, reason: 'credential_id_missing' };
  }

  const existing = await prisma.auditEvent.findFirst({
    where: { type: 'ON_COMPLETE', credentialId },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) {
    return { emitted: false, missing: [], reason: 'already_emitted' };
  }

  const priorEvents = await prisma.auditEvent.findMany({
    where: { type: { in: [...REQUIRED_ON_CHAIN] }, credentialId },
    orderBy: { createdAt: 'asc' },
  });

  const { state, missing } = mapOnChainEvents(
    priorEvents.map((event) => ({
      type: event.type,
      hash: event.hash,
      createdAt: event.createdAt,
    })),
  );

  if (missing.length > 0) {
    return { emitted: false, missing, chain: state, reason: 'missing_prerequisites' };
  }

  const audit = await params.writeAuditEvent({
    type: 'ON_COMPLETE',
    credentialId,
    metadata: {
      applicationId: params.applicationId,
      verifierId: params.verifierId ?? null,
      chain: {
        issued: state.issued,
        wallet: state.wallet,
        verified: state.verified,
      },
    },
  });

  return {
    emitted: true,
    missing: [],
    auditRef: audit.hash,
    chain: state,
  };
}
