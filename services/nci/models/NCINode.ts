import { Prisma, PrismaClient, NCINode as NCINodeRecord, NCINodeType } from '@prisma/client';

const prisma = new PrismaClient();

export const NCI_NODE_TYPES: readonly NCINodeType[] = [
  NCINodeType.CLINICIAN,
  NCINodeType.ISSUER,
  NCINodeType.VERIFIER,
  NCINodeType.STATE_BOARD,
  NCINodeType.PAYER,
  NCINodeType.ORG,
  NCINodeType.EHR_SYSTEM,
  NCINodeType.COMPACT_AUTHORITY,
] as const;

export interface RegisterNCINodeInput {
  did: string;
  nodeType: NCINodeType;
  jurisdiction?: string | null;
  metadata?: Record<string, unknown> | null;
  trustAnchorId?: string | null;
  nodeId?: string;
}

export interface UpdateNCINodeInput {
  jurisdiction?: string | null;
  metadata?: Record<string, unknown> | null;
  trustAnchorId?: string | null;
}

export class NCINodeService {
  constructor(private readonly client: PrismaClient = prisma) {}

  async registerNode(input: RegisterNCINodeInput): Promise<NCINodeRecord> {
    const did = normalizeDid(input.did);
    validateNodeType(input.nodeType);

    if (!did) {
      throw new Error('DID is required to register an NCI node');
    }

    return this.client.nCINode.upsert({
      where: { did },
      update: {
        nodeType: input.nodeType,
        jurisdiction: input.jurisdiction ?? undefined,
        metadata: toJson(input.metadata),
        trustAnchorId: input.trustAnchorId ?? null,
      },
      create: {
        nodeId: input.nodeId ?? undefined,
        did,
        nodeType: input.nodeType,
        jurisdiction: input.jurisdiction,
        metadata: toJson(input.metadata),
        trustAnchorId: input.trustAnchorId ?? null,
      },
    });
  }

  async updateNode(did: string, updates: UpdateNCINodeInput): Promise<NCINodeRecord> {
    const normalizedDid = normalizeDid(did);
    return this.client.nCINode.update({
      where: { did: normalizedDid },
      data: {
        jurisdiction: updates.jurisdiction ?? undefined,
        metadata: updates.metadata ? toJson(updates.metadata) : undefined,
        trustAnchorId: updates.trustAnchorId ?? undefined,
      },
    });
  }

  async getByDid(did: string): Promise<NCINodeRecord | null> {
    const normalizedDid = normalizeDid(did);
    if (!normalizedDid) {
      return null;
    }
    return this.client.nCINode.findUnique({ where: { did: normalizedDid } });
  }

  async listByType(nodeType: NCINodeType): Promise<NCINodeRecord[]> {
    validateNodeType(nodeType);
    return this.client.nCINode.findMany({
      where: { nodeType },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export function normalizeDid(did: string): string {
  return did?.trim();
}

function validateNodeType(nodeType: NCINodeType): void {
  if (!NCI_NODE_TYPES.includes(nodeType)) {
    throw new Error(`Unsupported NCI node type: ${nodeType}`);
  }
}

function toJson(metadata?: Record<string, unknown> | null): Prisma.JsonValue | null {
  if (!metadata) {
    return null;
  }
  return Object.entries(metadata).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value as unknown;
    }
    return acc;
  }, {});
}
