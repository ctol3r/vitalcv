import type {
  Prisma,
  PrismaClient,
  TrustRegistry as PrismaTrustRegistry,
  TrustEntityType as PrismaTrustEntityType,
} from '@prisma/client';
import { TrustEntityType as PrismaTrustEntityTypeEnum } from '@prisma/client';
import type { AccreditationStatus as PrismaAccreditationStatus } from '@prisma/client';
import {
  hydrateTrustRegistryRecord,
  registerTrustEntity,
  type TrustRegistryInput,
  type TrustRegistryView,
} from '../models/TrustRegistry';

export type CredentialKind = 'LICENSE' | 'BOARD_CERT' | 'SANCTIONS';

export interface TrustCredentialRequest {
  kind: CredentialKind;
  state?: string;
  board?: string;
  authority?: string;
}

export interface TrustAnchor extends TrustRegistryView {
  credentialKind: CredentialKind;
  path: string[];
  source: 'registry' | 'globalFallback';
}

interface StaticTrustNode extends TrustRegistryInput {
  pathSegments: string[];
}

const STATIC_LICENSE_AUTHORITIES: StaticTrustNode[] = [
  {
    entityId: 'ca-medical-board',
    entityType: PrismaTrustEntityTypeEnum.STATE_BOARD,
    did: 'did:web:trust.vitalcv/states/ca-medical-board',
    publicKeys: ['did:key:z6MkaCALICENSEKEY'],
    jurisdiction: 'CA',
    accreditationStatus: 'ACCREDITED' as PrismaAccreditationStatus,
    displayName: 'Medical Board of California',
    metrics: {
      verificationAccuracy: 0.995,
      freshnessHours: 6,
      uptimePercentage: 99.9,
    },
    metadata: {
      website: 'https://www.mbc.ca.gov/',
    },
    pathSegments: ['GLOBAL', 'STATE', 'CA'],
  },
  {
    entityId: 'tx-medical-board',
    entityType: PrismaTrustEntityTypeEnum.STATE_BOARD,
    did: 'did:web:trust.vitalcv/states/tx-medical-board',
    publicKeys: ['did:key:z6MkTXLICENSEKEY'],
    jurisdiction: 'TX',
    accreditationStatus: 'ACCREDITED' as PrismaAccreditationStatus,
    displayName: 'Texas Medical Board',
    metrics: {
      verificationAccuracy: 0.98,
      freshnessHours: 10,
      uptimePercentage: 99.2,
    },
    metadata: {
      website: 'https://www.tmb.state.tx.us/',
    },
    pathSegments: ['GLOBAL', 'STATE', 'TX'],
  },
];

const STATIC_BOARD_AUTHORITIES: StaticTrustNode[] = [
  {
    entityId: 'abms',
    entityType: PrismaTrustEntityTypeEnum.ORG,
    did: 'did:web:trust.vitalcv/national/abms',
    publicKeys: ['did:key:z6MkABMSKEY'],
    jurisdiction: 'US',
    accreditationStatus: 'ACCREDITED' as PrismaAccreditationStatus,
    displayName: 'American Board of Medical Specialties',
    metrics: {
      verificationAccuracy: 0.99,
      freshnessHours: 12,
      uptimePercentage: 99.7,
    },
    metadata: {
      authority: 'ABMS',
    },
    pathSegments: ['GLOBAL', 'BOARD', 'ABMS'],
  },
  {
    entityId: 'aoa',
    entityType: PrismaTrustEntityTypeEnum.ORG,
    did: 'did:web:trust.vitalcv/national/aoa',
    publicKeys: ['did:key:z6MkAOAKEY'],
    jurisdiction: 'US',
    accreditationStatus: 'ACCREDITED' as PrismaAccreditationStatus,
    displayName: 'American Osteopathic Association',
    metrics: {
      verificationAccuracy: 0.97,
      freshnessHours: 18,
      uptimePercentage: 99.1,
    },
    metadata: {
      authority: 'AOA',
    },
    pathSegments: ['GLOBAL', 'BOARD', 'AOA'],
  },
];

const STATIC_SANCTION_AUTHORITIES: StaticTrustNode[] = [
  {
    entityId: 'hhs-oig',
    entityType: PrismaTrustEntityTypeEnum.VERIFIER,
    did: 'did:web:trust.vitalcv/federal/hhs-oig',
    publicKeys: ['did:key:z6MkOIGKEY'],
    jurisdiction: 'US',
    accreditationStatus: 'ACCREDITED' as PrismaAccreditationStatus,
    displayName: 'HHS OIG Exclusions',
    metrics: {
      verificationAccuracy: 0.93,
      freshnessHours: 24,
      uptimePercentage: 98.5,
    },
    metadata: {
      authority: 'OIG',
    },
    pathSegments: ['GLOBAL', 'VERIFIER', 'HHS-OIG'],
  },
];

const STATIC_TRUST_NODES: StaticTrustNode[] = [
  ...STATIC_LICENSE_AUTHORITIES,
  ...STATIC_BOARD_AUTHORITIES,
  ...STATIC_SANCTION_AUTHORITIES,
];

let seedPromise: Promise<void> | null = null;

export function seedGlobalTrustRegistry(prisma: PrismaClient): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      for (const node of STATIC_TRUST_NODES) {
        await registerTrustEntity(prisma, node);
      }
    })();
  }
  return seedPromise;
}

export class TrustedIssuerGraph {
  constructor(private prisma: PrismaClient) {}

  async resolve(request: TrustCredentialRequest): Promise<TrustAnchor[]> {
    const registryRecords = await this.lookupRegistry(request);
    if (registryRecords.length > 0) {
      return registryRecords.map((record) => this.hydrateAnchor(record, request, 'registry'));
    }

    const fallbackRecords = this.lookupFallback(request);
    return fallbackRecords.map((record) => this.hydrateAnchor(record, request, 'globalFallback'));
  }

  private async lookupRegistry(request: TrustCredentialRequest): Promise<PrismaTrustRegistry[]> {
    const where: Prisma.TrustRegistryWhereInput = {};

    if (request.kind === 'LICENSE') {
      if (!request.state) {
        return [];
      }
      where.entityType = PrismaTrustEntityTypeEnum.STATE_BOARD;
      where.jurisdiction = request.state;
    } else if (request.kind === 'BOARD_CERT') {
      const boardId = request.board?.toLowerCase();
      if (!boardId) {
        return [];
      }
      where.entityId = boardId;
    } else if (request.kind === 'SANCTIONS') {
      const authority = request.authority?.toLowerCase() ?? 'oig';
      where.entityId = authority === 'oig' ? 'hhs-oig' : authority;
    }

    if (Object.keys(where).length === 0) {
      return [];
    }

    return this.prisma.trustRegistry.findMany({
      where,
      orderBy: { entityId: 'asc' },
    });
  }

  private lookupFallback(request: TrustCredentialRequest): StaticTrustNode[] {
    if (request.kind === 'LICENSE') {
      const state = request.state?.toUpperCase();
      return STATIC_LICENSE_AUTHORITIES.filter((node) => node.jurisdiction === state);
    }

    if (request.kind === 'BOARD_CERT') {
      const board = request.board?.toUpperCase();
      return STATIC_BOARD_AUTHORITIES.filter((node) => node.metadata?.authority === board);
    }

    if (request.kind === 'SANCTIONS') {
      const authority = request.authority?.toUpperCase() || 'OIG';
      return STATIC_SANCTION_AUTHORITIES.filter(
        (node) => (node.metadata?.authority as string | undefined)?.toUpperCase() === authority
      );
    }

    return [];
  }

  private hydrateAnchor(
    record: PrismaTrustRegistry | StaticTrustNode,
    request: TrustCredentialRequest,
    source: 'registry' | 'globalFallback'
  ): TrustAnchor {
    const prismaRecord = isStaticNode(record) ? staticNodeToRecord(record) : record;
    const view = hydrateTrustRegistryRecord(prismaRecord, { source });

    return {
      ...view,
      credentialKind: request.kind,
      source,
      path: isStaticNode(record) ? record.pathSegments : buildDynamicPath(request, view),
    };
  }
}

function isStaticNode(node: PrismaTrustRegistry | StaticTrustNode): node is StaticTrustNode {
  return 'pathSegments' in node;
}

function staticNodeToRecord(node: StaticTrustNode): PrismaTrustRegistry {
  const now = new Date();
  return {
    id: `static-${node.entityId}`,
    entityId: node.entityId,
    entityType: node.entityType,
    did: node.did,
    publicKeys: node.publicKeys,
    jurisdiction: node.jurisdiction ?? null,
    accreditationStatus: node.accreditationStatus,
    metadata: {
      ...(node.metadata ?? {}),
      ...(node.displayName ? { displayName: node.displayName } : {}),
      ...(node.metrics ? { metrics: node.metrics } : {}),
    } as Prisma.InputJsonValue,
    createdAt: now,
    updatedAt: now,
  };
}

function buildDynamicPath(request: TrustCredentialRequest, view: TrustRegistryView): string[] {
  if (request.kind === 'LICENSE') {
    return ['GLOBAL', 'STATE', view.jurisdiction || 'UNKNOWN', view.entityId];
  }
  if (request.kind === 'BOARD_CERT') {
    return ['GLOBAL', 'BOARD', view.entityId];
  }
  if (request.kind === 'SANCTIONS') {
    return ['GLOBAL', 'VERIFIER', view.entityId];
  }
  return ['GLOBAL', view.entityId];
}

