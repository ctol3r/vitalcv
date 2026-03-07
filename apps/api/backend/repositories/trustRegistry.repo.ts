import { Prisma } from '@prisma/client';
import prisma from '../src/graphql/prisma_client';
import type {
  IssuerStatus,
  TrustedIssuer,
  TrustLevel,
} from '../src/services/registry/trustRegistry';

export interface TrustRegistryReputationUpdate {
  trustScore: number;
  verificationCount: number;
  revocationCount: number;
}

export interface TrustRegistryRepository {
  seedDefaults(issuers: readonly TrustedIssuer[]): Promise<void>;
  listIssuers(): Promise<TrustedIssuer[]>;
  upsertIssuer(issuer: TrustedIssuer): Promise<TrustedIssuer>;
  updateIssuerStatus(issuerId: string, status: IssuerStatus): Promise<TrustedIssuer | null>;
  updateIssuerReputation(
    issuerId: string,
    reputation: TrustRegistryReputationUpdate,
  ): Promise<TrustedIssuer | null>;
}

type TrustedIssuerRow = {
  id: string;
  name: string;
  did: string;
  publicKeyJwk: Prisma.JsonValue;
  publicKeyPem: string;
  trustLevel: string;
  status: string;
  trustScore: number | null;
  verificationCount: number | null;
  revocationCount: number | null;
  lastScoredAt: Date | null;
  assuranceProfile: string | null;
  algorithmPolicy: string[];
  haipCompliant: boolean | null;
  federationEntityId: string | null;
  federationTrustChain: string[];
  federatedAt: Date | null;
  registryMetadata: Prisma.JsonValue | null;
  active: boolean;
  organizationId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function isJsonObject(value: unknown): value is Prisma.JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coerceTrustLevel(value: string): TrustLevel {
  if (value === 'AUTHORITATIVE' || value === 'TRUSTED' || value === 'PROVISIONAL' || value === 'UNTRUSTED') {
    return value;
  }
  return 'PROVISIONAL';
}

function coerceIssuerStatus(value: string, active: boolean): IssuerStatus {
  if (value === 'ACTIVE' || value === 'SUSPENDED' || value === 'REVOKED') {
    return value;
  }
  return active ? 'ACTIVE' : 'SUSPENDED';
}

function toDomainIssuer(row: TrustedIssuerRow): TrustedIssuer {
  const metadata = isJsonObject(row.registryMetadata)
    ? (row.registryMetadata as Record<string, unknown>)
    : undefined;

  return {
    issuerId: row.did,
    issuerName: row.name,
    publicKey: row.publicKeyPem,
    trustLevel: coerceTrustLevel(row.trustLevel),
    status: coerceIssuerStatus(row.status, row.active),
    registeredAt: row.createdAt.toISOString(),
    ...(row.trustScore !== null ? { trustScore: row.trustScore } : {}),
    ...(row.verificationCount !== null ? { verificationCount: row.verificationCount } : {}),
    ...(row.revocationCount !== null ? { revocationCount: row.revocationCount } : {}),
    ...(row.lastScoredAt ? { lastScoredAt: row.lastScoredAt.toISOString() } : {}),
    ...(row.assuranceProfile ? { assuranceProfile: row.assuranceProfile } : {}),
    ...(row.algorithmPolicy.length > 0 ? { algorithmPolicy: row.algorithmPolicy } : {}),
    ...(row.haipCompliant !== null ? { haipCompliant: row.haipCompliant } : {}),
    ...(row.federationEntityId ? { federationEntityId: row.federationEntityId } : {}),
    ...(row.federationTrustChain.length > 0 ? { federationTrustChain: row.federationTrustChain } : {}),
    ...(row.federatedAt ? { federatedAt: row.federatedAt.toISOString() } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function getPublicKeyJwk(metadata: Record<string, unknown> | undefined): Prisma.InputJsonValue {
  const candidate = metadata?.publicKeyJwk;
  if (isJsonObject(candidate)) {
    return candidate as Prisma.InputJsonObject;
  }
  return {};
}

function sortIssuers(issuers: TrustedIssuer[]): TrustedIssuer[] {
  return [...issuers].sort((left, right) => left.issuerId.localeCompare(right.issuerId));
}

export class PrismaTrustRegistryRepository implements TrustRegistryRepository {
  async seedDefaults(issuers: readonly TrustedIssuer[]): Promise<void> {
    for (const issuer of issuers) {
      const existing = await prisma.trustedIssuer.findUnique({
        where: { did: issuer.issuerId },
        select: { did: true },
      });
      if (existing) {
        continue;
      }

      await prisma.trustedIssuer.create({
        data: {
          name: issuer.issuerName,
          did: issuer.issuerId,
          publicKeyJwk: getPublicKeyJwk(issuer.metadata),
          publicKeyPem: issuer.publicKey,
          trustLevel: issuer.trustLevel,
          status: issuer.status,
          trustScore: issuer.trustScore ?? null,
          verificationCount: issuer.verificationCount ?? null,
          revocationCount: issuer.revocationCount ?? null,
          lastScoredAt: issuer.lastScoredAt ? new Date(issuer.lastScoredAt) : null,
          assuranceProfile: issuer.assuranceProfile ?? null,
          algorithmPolicy: issuer.algorithmPolicy ?? [],
          haipCompliant: issuer.haipCompliant ?? null,
          federationEntityId: issuer.federationEntityId ?? null,
          federationTrustChain: issuer.federationTrustChain ?? [],
          federatedAt: issuer.federatedAt ? new Date(issuer.federatedAt) : null,
          ...(issuer.metadata ? { registryMetadata: issuer.metadata as Prisma.InputJsonObject } : {}),
          active: issuer.status === 'ACTIVE',
          createdAt: new Date(issuer.registeredAt),
        },
      });
    }
  }

  async listIssuers(): Promise<TrustedIssuer[]> {
    const rows = await prisma.trustedIssuer.findMany({
      orderBy: { did: 'asc' },
    });
    return sortIssuers(rows.map((row) => toDomainIssuer(row)));
  }

  async upsertIssuer(issuer: TrustedIssuer): Promise<TrustedIssuer> {
    const existing = await prisma.trustedIssuer.findUnique({
      where: { did: issuer.issuerId },
    });

    const metadata = issuer.metadata;
    const baseData = {
      name: issuer.issuerName,
      publicKeyPem: issuer.publicKey,
      trustLevel: issuer.trustLevel,
      status: issuer.status,
      trustScore: issuer.trustScore ?? null,
      verificationCount: issuer.verificationCount ?? null,
      revocationCount: issuer.revocationCount ?? null,
      lastScoredAt: issuer.lastScoredAt ? new Date(issuer.lastScoredAt) : null,
      assuranceProfile: issuer.assuranceProfile ?? null,
      algorithmPolicy: issuer.algorithmPolicy ?? [],
      haipCompliant: issuer.haipCompliant ?? null,
      federationEntityId: issuer.federationEntityId ?? null,
      federationTrustChain: issuer.federationTrustChain ?? [],
      federatedAt: issuer.federatedAt ? new Date(issuer.federatedAt) : null,
      active: issuer.status === 'ACTIVE',
      publicKeyJwk: existing?.publicKeyJwk ?? getPublicKeyJwk(metadata),
    };

    const row = existing
      ? await prisma.trustedIssuer.update({
          where: { did: issuer.issuerId },
          data: {
            ...baseData,
            ...(metadata ? { registryMetadata: metadata as Prisma.InputJsonObject } : {}),
          },
        })
      : await prisma.trustedIssuer.create({
          data: {
            did: issuer.issuerId,
            createdAt: new Date(issuer.registeredAt),
            ...baseData,
            ...(metadata ? { registryMetadata: metadata as Prisma.InputJsonObject } : {}),
          },
        });

    return toDomainIssuer(row);
  }

  async updateIssuerStatus(issuerId: string, status: IssuerStatus): Promise<TrustedIssuer | null> {
    const existing = await prisma.trustedIssuer.findUnique({
      where: { did: issuerId },
    });
    if (!existing) {
      return null;
    }

    const row = await prisma.trustedIssuer.update({
      where: { did: issuerId },
      data: {
        status,
        active: status === 'ACTIVE',
      },
    });
    return toDomainIssuer(row);
  }

  async updateIssuerReputation(
    issuerId: string,
    reputation: TrustRegistryReputationUpdate,
  ): Promise<TrustedIssuer | null> {
    const existing = await prisma.trustedIssuer.findUnique({
      where: { did: issuerId },
    });
    if (!existing) {
      return null;
    }

    const row = await prisma.trustedIssuer.update({
      where: { did: issuerId },
      data: {
        trustScore: reputation.trustScore,
        verificationCount: reputation.verificationCount,
        revocationCount: reputation.revocationCount,
        lastScoredAt: new Date(),
      },
    });
    return toDomainIssuer(row);
  }
}

export class InMemoryTrustRegistryRepository implements TrustRegistryRepository {
  private readonly issuers = new Map<string, TrustedIssuer>();

  constructor(initialIssuers: readonly TrustedIssuer[] = []) {
    for (const issuer of initialIssuers) {
      this.issuers.set(issuer.issuerId, { ...issuer });
    }
  }

  async seedDefaults(issuers: readonly TrustedIssuer[]): Promise<void> {
    for (const issuer of issuers) {
      if (!this.issuers.has(issuer.issuerId)) {
        this.issuers.set(issuer.issuerId, { ...issuer });
      }
    }
  }

  async listIssuers(): Promise<TrustedIssuer[]> {
    return sortIssuers(Array.from(this.issuers.values()).map((issuer) => ({ ...issuer })));
  }

  async upsertIssuer(issuer: TrustedIssuer): Promise<TrustedIssuer> {
    const stored = { ...issuer };
    this.issuers.set(issuer.issuerId, stored);
    return { ...stored };
  }

  async updateIssuerStatus(issuerId: string, status: IssuerStatus): Promise<TrustedIssuer | null> {
    const issuer = this.issuers.get(issuerId);
    if (!issuer) {
      return null;
    }

    const updated: TrustedIssuer = {
      ...issuer,
      status,
    };
    this.issuers.set(issuerId, updated);
    return { ...updated };
  }

  async updateIssuerReputation(
    issuerId: string,
    reputation: TrustRegistryReputationUpdate,
  ): Promise<TrustedIssuer | null> {
    const issuer = this.issuers.get(issuerId);
    if (!issuer) {
      return null;
    }

    const updated: TrustedIssuer = {
      ...issuer,
      trustScore: reputation.trustScore,
      verificationCount: reputation.verificationCount,
      revocationCount: reputation.revocationCount,
      lastScoredAt: new Date().toISOString(),
    };
    this.issuers.set(issuerId, updated);
    return { ...updated };
  }
}
