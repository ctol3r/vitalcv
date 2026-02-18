import type { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';

export type TrustLevel = 'full' | 'partial' | 'proof-only';
type StoredTrustLevel = 'full' | 'partial' | 'proof-only' | 'inactive';

type OrganizationTrustRecord = {
  sourceOrgId: string;
  targetOrgId: string;
  trustLevel: StoredTrustLevel;
  active: boolean;
};

const SUPPORTED_TRUST_LEVELS: ReadonlySet<StoredTrustLevel> = new Set([
  'full',
  'partial',
  'proof-only',
  'inactive',
]);

function isSupportedTrustLevel(level: string | undefined): level is StoredTrustLevel {
  return level !== undefined && SUPPORTED_TRUST_LEVELS.has(level as StoredTrustLevel);
}

function normalizeStoredLevel(level: string | undefined): StoredTrustLevel | null {
  if (typeof level !== 'string') {
    return null;
  }
  const normalized = level.trim().toLowerCase();
  return isSupportedTrustLevel(normalized) ? normalized : null;
}

function toTrustLevel(level: StoredTrustLevel | null): TrustLevel | null {
  if (!level || level === 'inactive') {
    return null;
  }
  return level;
}

export async function getFederatedTrustLevel(
  sourceOrgId: string,
  targetOrgId: string,
): Promise<TrustLevel | null> {
  const normalizedSource = sourceOrgId.trim();
  const normalizedTarget = targetOrgId.trim();
  if (!normalizedSource || !normalizedTarget) {
    return null;
  }

  if (normalizedSource === normalizedTarget) {
    return 'full';
  }

  const row = await prisma.organizationTrust.findFirst({
    where: {
      sourceOrgId: normalizedSource,
      targetOrgId: normalizedTarget,
      active: true,
    },
    select: {
      sourceOrgId: true,
      targetOrgId: true,
      trustLevel: true,
      active: true,
    } as unknown as Prisma.OrganizationTrustSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  if (!row) {
    return null;
  }

  const normalizedTrustLevel = normalizeStoredLevel(row.trustLevel as string);
  return toTrustLevel(normalizedTrustLevel);
}

export async function canOrgVerify(sourceOrgId: string, targetOrgId: string): Promise<boolean> {
  const level = await getFederatedTrustLevel(sourceOrgId, targetOrgId);
  return level !== null;
}

export async function getActiveOrganizationTrustLinks(): Promise<number> {
  return prisma.organizationTrust.count({ where: { active: true } });
}

export async function getTotalOrganizationTrustLinks(): Promise<number> {
  const rawCount = await prisma.organizationTrust.count();
  return rawCount;
}

export function toOrganizationTrustRecord(raw: {
  sourceOrgId: string;
  targetOrgId: string;
  trustLevel: string;
  active: boolean;
}): OrganizationTrustRecord {
  return {
    sourceOrgId: raw.sourceOrgId,
    targetOrgId: raw.targetOrgId,
    trustLevel: normalizeStoredLevel(raw.trustLevel) ?? 'inactive',
    active: raw.active,
  };
}
