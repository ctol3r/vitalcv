/**
 * Credential Registry collector
 * Collects state from CredentialRegistry pallet and related services
 */

import type { PrismaClient } from '@prisma/client';

export interface CredentialRegistryState {
  totalCredentials: number;
  activeCredentials: number;
  revokedCredentials: number;
  issuers: number;
  holders: number;
  credentialTypes: string[];
  lastUpdated: string;
}

export async function collectCredentialRegistry(
  prisma: PrismaClient
): Promise<CredentialRegistryState> {
  try {
    // Try to query credential-related tables
    // Adjust table names based on your actual Prisma schema

    const credentialCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "Credential"
      WHERE "revoked" = false
    `.catch(() => [{ count: 0n }]);

    const revokedCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "Credential"
      WHERE "revoked" = true
    `.catch(() => [{ count: 0n }]);

    const issuerCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT "issuerId") as count
      FROM "Credential"
    `.catch(() => [{ count: 0n }]);

    const holderCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT "holderId") as count
      FROM "Credential"
    `.catch(() => [{ count: 0n }]);

    const credentialTypes = await prisma.$queryRaw<Array<{ type: string }>>`
      SELECT DISTINCT "type" as type
      FROM "Credential"
      LIMIT 20
    `.catch(() => []);

    return {
      totalCredentials: Number(credentialCount[0]?.count || 0) + Number(revokedCount[0]?.count || 0),
      activeCredentials: Number(credentialCount[0]?.count || 0),
      revokedCredentials: Number(revokedCount[0]?.count || 0),
      issuers: Number(issuerCount[0]?.count || 0),
      holders: Number(holderCount[0]?.count || 0),
      credentialTypes: credentialTypes.map(r => r.type).filter(Boolean),
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    // Return safe defaults if queries fail
    console.warn('[state-agent] Failed to collect credential registry state:', error);
    return {
      totalCredentials: 0,
      activeCredentials: 0,
      revokedCredentials: 0,
      issuers: 0,
      holders: 0,
      credentialTypes: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}

