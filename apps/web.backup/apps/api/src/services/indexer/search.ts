import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface IndexSearchInput {
  query: string;
  clinicianId?: string;
  limit?: number;
}

export interface IndexSearchHit {
  key: string;
  clinicianId: string;
  credentialType: string;
  credentialId: string;
  issuerDid: string;
  status: string;
  summary: Record<string, unknown>;
  matchReason: string;
  source: 'index' | 'license' | 'credential' | 'issuer' | 'specialty';
}

export interface IndexSearchResult {
  query: string;
  total: number;
  matches: IndexSearchHit[];
}

export async function searchMasterIndex(input: IndexSearchInput): Promise<IndexSearchResult> {
  const query = (input.query ?? '').trim();
  if (!query) {
    return { query: '', total: 0, matches: [] };
  }

  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const normalized = query.toLowerCase();

  const [indexRows, licenseRows, credentialRows, issuerRows, specialtyRows] = await Promise.all([
    prisma.masterCredentialIndex.findMany({
      where: {
        ...(input.clinicianId ? { clinicianId: input.clinicianId } : {}),
        OR: [
          { credentialId: { contains: query, mode: 'insensitive' } },
          { credentialType: { contains: query, mode: 'insensitive' } },
          { issuerDid: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { lastUpdated: 'desc' },
      take: limit,
    }),
    prisma.stateLicenseVerification.findMany({
      where: {
        OR: [
          { licenseNumber: { contains: query, mode: 'insensitive' } },
          { state: { contains: query, mode: 'insensitive' } },
        ],
        ...(input.clinicianId ? { clinicianId: input.clinicianId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    }),
    prisma.credential.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { type: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { issuedAt: 'desc' },
      take: limit,
    }),
    prisma.trustedIssuer.findMany({
      where: {
        OR: [
          { did: { contains: query, mode: 'insensitive' } },
          { orgName: { contains: query, mode: 'insensitive' } },
          { orgNpi: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
    }),
    prisma.clinicianProfile.findMany({
      where: {
        specialty: { contains: query, mode: 'insensitive' },
      },
      take: limit,
      select: {
        id: true,
        specialty: true,
        npi: true,
      },
    }),
  ]);

  const matches: IndexSearchHit[] = [];

  indexRows.forEach((row) => {
    matches.push({
      key: `${row.credentialType}:${row.credentialId}`,
      clinicianId: row.clinicianId,
      credentialType: row.credentialType,
      credentialId: row.credentialId,
      issuerDid: row.issuerDid,
      status: row.status,
      summary: {
        source: 'index',
        lastUpdated: row.lastUpdated.toISOString(),
      },
      matchReason: 'Index match',
      source: 'index',
    });
  });

  licenseRows.forEach((license) => {
    matches.push({
      key: `license:${license.id}`,
      clinicianId: license.clinicianId,
      credentialType: 'license',
      credentialId: license.id,
      issuerDid: String((license as any).issuingAuthority ?? 'did:web:issuer.vitalcv/stateboard'),
      status: license.status ?? 'UNKNOWN',
      summary: {
        state: license.state,
        licenseNumber: license.licenseNumber,
        expiresAt: license.expiryDate?.toISOString() ?? null,
      },
      matchReason: license.licenseNumber?.toLowerCase().includes(normalized)
        ? 'License number match'
        : 'License state match',
      source: 'license',
    });
  });

  credentialRows.forEach((credential) => {
    matches.push({
      key: `${credential.type}:${credential.id}`,
      clinicianId: input.clinicianId ?? 'unknown',
      credentialType: credential.type ?? 'credential',
      credentialId: credential.id,
      issuerDid: extractIssuerDid(credential.issuer),
      status: credential.status ?? 'unknown',
      summary: {
        label: credential.name ?? credential.type,
        issuedAt: credential.issuedAt?.toISOString() ?? null,
        expiresAt: credential.expiresAt?.toISOString() ?? null,
      },
      matchReason: credential.name?.toLowerCase().includes(normalized)
        ? 'Credential name match'
        : 'Credential type match',
      source: 'credential',
    });
  });

  issuerRows.forEach((issuer) => {
    matches.push({
      key: `issuer:${issuer.id}`,
      clinicianId: input.clinicianId ?? 'any',
      credentialType: 'issuer',
      credentialId: issuer.id,
      issuerDid: issuer.did,
      status: issuer.accreditation ?? 'unknown',
      summary: {
        orgName: issuer.orgName,
        orgNpi: issuer.orgNpi,
        jurisdiction: issuer.jurisdiction,
      },
      matchReason: 'Issuer directory match',
      source: 'issuer',
    });
  });

  specialtyRows.forEach((profile) => {
    matches.push({
      key: `specialty:${profile.id}`,
      clinicianId: profile.id,
      credentialType: 'specialty',
      credentialId: profile.id,
      issuerDid: 'did:web:vitalcv.specialty',
      status: 'active',
      summary: {
        specialty: profile.specialty,
        npi: profile.npi,
      },
      matchReason: 'Specialty keyword match',
      source: 'specialty',
    });
  });

  const deduped = dedupeMatches(matches).slice(0, limit);

  return {
    query,
    total: deduped.length,
    matches: deduped,
  };
}

function dedupeMatches(matches: IndexSearchHit[]): IndexSearchHit[] {
  const seen = new Set<string>();
  const result: IndexSearchHit[] = [];
  for (const match of matches) {
    if (seen.has(match.key)) continue;
    seen.add(match.key);
    result.push(match);
  }
  return result;
}

function extractIssuerDid(value: unknown): string {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    const record = value as { id?: unknown };
    if (typeof record.id === 'string') {
      return record.id;
    }
  }
  return '';
}


