import { PrismaClient, type Prisma, type TrustedIssuer } from '@prisma/client';
import { createHash } from 'crypto';
import { anchorEvent } from '../audit/anchor';
import type { AnchorRecord } from '../verify/anchor';
import type {
  IndexBuildOptions,
  IndexCredentialType,
  IndexSnapshot,
  IndexStatus,
  IndexStatusSummary,
  IndexTimelineEvent,
  MasterIndexRow,
} from './types';

const prisma = new PrismaClient();

const DEFAULT_ISSUERS: Record<IndexCredentialType, string> = {
  license: process.env.STATE_LICENSE_ISSUER_DID ?? 'did:web:issuer.vitalcv/stateboard',
  board: process.env.BOARD_ISSUER_DID ?? 'did:web:issuer.vitalcv/board',
  employment: process.env.EMPLOYER_ISSUER_DID ?? 'did:web:issuer.vitalcv/employer',
  dea_mate: process.env.DEA_ISSUER_DID ?? 'did:web:dea.vitalcv',
  compact: process.env.COMPACT_ISSUER_DID ?? 'did:web:issuer.vitalcv/compact',
};

const BOARD_MATCHERS = ['board', 'abms', 'abo'];
const EMPLOYMENT_MATCHERS = ['employment', 'employer', 'work'];

export interface BuildIndexResult extends IndexSnapshot {
  anchor?: AnchorRecord;
}

export async function buildMasterCredentialIndex(
  clinicianId: string,
  options: IndexBuildOptions = {},
): Promise<BuildIndexResult> {
  if (!clinicianId) {
    throw new Error('clinicianId is required to build the master credential index');
  }

  const client = options.prisma ?? prisma;
  const now = options.now ?? new Date();

  const clinician = await client.clinicianProfile.findUnique({
    where: { id: clinicianId },
    include: {
      user: {
        select: {
          id: true,
          did: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!clinician) {
    throw new Error(`Clinician ${clinicianId} not found`);
  }

  const [
    trustedIssuers,
    licenses,
    boardCredentials,
    employmentCredentials,
    deaRecords,
    compactWallets,
    compactStatus,
    compactEligibility,
  ] = await Promise.all([
    client.trustedIssuer.findMany(),
    client.stateLicenseVerification.findMany({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
    }),
    fetchCredentialSlice(client, clinician.user?.id, BOARD_MATCHERS),
    fetchCredentialSlice(client, clinician.user?.id, EMPLOYMENT_MATCHERS),
    client.dEACredential.findMany({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
    }),
    client.clinicianCompactWallet.findMany({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
    }),
    clinician.user?.did
      ? client.compactsStatus.findUnique({
          where: { clinicianDid: clinician.user.did },
        })
      : null,
    client.compactEligibility.findMany({
      where: { clinicianId },
    }),
  ]);

  const issuerDirectory = buildIssuerDirectory(trustedIssuers);
  const rows: MasterIndexRow[] = [];

  rows.push(
    ...buildLicenseRows({
      clinicianId,
      licenses,
      issuerDirectory,
      now,
    }),
  );

  rows.push(
    ...buildCredentialRows({
      clinicianId,
      credentials: boardCredentials,
      issuerDirectory,
      now,
      type: 'board',
    }),
  );

  rows.push(
    ...buildCredentialRows({
      clinicianId,
      credentials: employmentCredentials,
      issuerDirectory,
      now,
      type: 'employment',
    }),
  );

  rows.push(
    ...buildDeaRows({
      clinicianId,
      records: deaRecords,
      issuerDirectory,
      now,
    }),
  );

  rows.push(
    ...buildCompactRows({
      clinicianId,
      wallets: compactWallets,
      status: compactStatus,
      eligibility: compactEligibility,
      issuerDirectory,
      now,
    }),
  );

  rows.sort((a, b) => a.hash.localeCompare(b.hash));

  const map = rows.reduce<Record<IndexCredentialType, MasterIndexRow[]>>(
    (acc, row) => {
      acc[row.credentialType] = acc[row.credentialType] ?? [];
      acc[row.credentialType].push(row);
      return acc;
    },
    {
      license: [],
      board: [],
      employment: [],
      dea_mate: [],
      compact: [],
    },
  );

  const stats = buildStatusSummary(rows);
  const snapshotHash = createHash('sha256')
    .update(
      JSON.stringify(
        rows.map((row) => ({
          credentialType: row.credentialType,
          credentialId: row.credentialId,
          issuerDid: row.issuerDid,
          status: row.status,
          lastUpdated: row.lastUpdated,
        })),
      ),
    )
    .digest('hex');

  const anchor = anchorEvent('indexSnapshot', {
    clinicianId,
    indexHash: snapshotHash,
    credentialCount: rows.length,
    generatedAt: now.toISOString(),
    status: stats.byStatus,
  });

  if (!options.skipPersist) {
    await persistRows(client, clinicianId, rows);
  }

  return {
    clinicianId,
    generatedAt: now.toISOString(),
    rows,
    map,
    stats,
    snapshotHash,
    anchor,
  };
}

async function fetchCredentialSlice(
  client: PrismaClient,
  userId: string | number | null | undefined,
  matchers: string[],
) {
  if (!userId) {
    return [] as Prisma.CredentialGetPayload<{}>[];
  }

  return client.credential.findMany({
    where: {
      userId: String(userId),
      OR: matchers.flatMap((token) => [
        {
          type: { contains: token, mode: 'insensitive' as const },
        },
        {
          name: { contains: token, mode: 'insensitive' as const },
        },
      ]),
    },
    orderBy: { issuedAt: 'desc' },
  });
}

function buildLicenseRows(params: {
  clinicianId: string;
  licenses: Prisma.StateLicenseVerificationGetPayload<{}>[];
  issuerDirectory: IssuerDirectory;
  now: Date;
}): MasterIndexRow[] {
  const { clinicianId, licenses, issuerDirectory, now } = params;
  return licenses.map((license) => {
    const rawStatus = (license.status ?? '').toUpperCase();
    const status = deriveStatusFromLicense(license, now);
    const issuerHint = typeof (license as any).issuingAuthority === 'string' ? (license as any).issuingAuthority : license.state;
    const issuerDid = resolveIssuerDid(issuerDirectory, issuerHint, DEFAULT_ISSUERS.license);
    const summary = {
      label: buildLicenseLabel(license),
      state: license.state,
      licenseNumber: license.licenseNumber,
      status: rawStatus || status.toUpperCase(),
      expiresAt: license.expiryDate ? license.expiryDate.toISOString() : null,
      verifiedAt: license.verifiedAt ? license.verifiedAt.toISOString() : license.updatedAt?.toISOString() ?? null,
      disciplinaryFlag: Boolean((license as any).disciplinaryFlag),
      source: (license as any).source ?? 'state_board',
    };

    const timeline: IndexTimelineEvent[] = [];
    if (license.issueDate) {
      timeline.push({
        label: 'Issued',
        occurredAt: license.issueDate.toISOString(),
        status: 'active',
        context: license.state ?? undefined,
      });
    }
    if (license.verifiedAt) {
      timeline.push({
        label: 'Verified',
        occurredAt: license.verifiedAt.toISOString(),
        status,
        context: summary.source,
      });
    }
    if (license.expiryDate) {
      timeline.push({
        label: 'Expires',
        occurredAt: license.expiryDate.toISOString(),
        status: license.expiryDate.getTime() < now.getTime() ? 'expired' : status,
        context: license.state ?? undefined,
      });
    }

    return buildRow({
      clinicianId,
      credentialId: license.id,
      credentialType: 'license',
      issuerDid,
      status,
      summary,
      timeline,
      lastUpdated:
        license.updatedAt?.toISOString() ??
        license.verifiedAt?.toISOString() ??
        now.toISOString(),
    });
  });
}

function buildCredentialRows(params: {
  clinicianId: string;
  credentials: Prisma.CredentialGetPayload<{}>[];
  issuerDirectory: IssuerDirectory;
  now: Date;
  type: Exclude<IndexCredentialType, 'license' | 'dea_mate' | 'compact'>;
}): MasterIndexRow[] {
  const { clinicianId, credentials, issuerDirectory, now, type } = params;
  return credentials.map((credential) => {
    const issuerHint = extractIssuerHint(credential.issuer);
    const issuerDid = resolveIssuerDid(
      issuerDirectory,
      issuerHint || credential.name || credential.type,
      DEFAULT_ISSUERS[type],
    );
    const status = deriveStatusFromCredential(credential, now);
    const summary: Record<string, unknown> = {
      label: credential.name ?? credential.type ?? credential.id,
      status: credential.status ?? status,
      issuedAt: credential.issuedAt?.toISOString() ?? null,
      expiresAt: credential.expiresAt?.toISOString() ?? null,
      metadata: credential.metadata ?? {},
    };
    if (type === 'employment' && credential.metadata && typeof credential.metadata === 'object') {
      const meta = credential.metadata as Record<string, unknown>;
      summary.organization = meta.organization ?? meta.orgName ?? meta.employer;
      summary.roleTitle = meta.role ?? meta.position ?? meta.title;
      summary.startDate = meta.startDate ?? meta.effectiveDate;
      summary.endDate = meta.endDate ?? meta.terminationDate;
    }

    const timeline: IndexTimelineEvent[] = [];
    if (credential.issuedAt) {
      timeline.push({
        label: 'Issued',
        occurredAt: credential.issuedAt.toISOString(),
        status: 'active',
      });
    }
    if (credential.expiresAt) {
      timeline.push({
        label: 'Expires',
        occurredAt: credential.expiresAt.toISOString(),
        status: credential.expiresAt.getTime() < now.getTime() ? 'expired' : status,
      });
    }
    if (credential.updatedAt) {
      timeline.push({
        label: 'Updated',
        occurredAt: credential.updatedAt.toISOString(),
        status,
      });
    }

    return buildRow({
      clinicianId,
      credentialId: credential.id,
      credentialType: type,
      issuerDid,
      status,
      summary,
      timeline,
      lastUpdated:
        credential.updatedAt?.toISOString() ??
        credential.issuedAt?.toISOString() ??
        now.toISOString(),
    });
  });
}

function buildDeaRows(params: {
  clinicianId: string;
  records: Prisma.DEACredentialGetPayload<{}>[];
  issuerDirectory: IssuerDirectory;
  now: Date;
}): MasterIndexRow[] {
  const { clinicianId, records, issuerDirectory, now } = params;
  return records.map((record) => {
    const status = deriveStatusFromDate(record.expiration, now);
    const summary = {
      label: `DEA ${record.deaNumber}`,
      deaNumber: record.deaNumber,
      status,
      expiresAt: record.expiration.toISOString(),
      mateHours: record.mateHours,
      metadata: record.metadata ?? {},
    };

    const timeline: IndexTimelineEvent[] = [
      {
        label: 'Expires',
        occurredAt: record.expiration.toISOString(),
        status: status,
      },
    ];

    return buildRow({
      clinicianId,
      credentialId: record.id,
      credentialType: 'dea_mate',
      issuerDid: resolveIssuerDid(issuerDirectory, 'dea', DEFAULT_ISSUERS.dea_mate),
      status,
      summary,
      timeline,
      lastUpdated: record.updatedAt?.toISOString() ?? now.toISOString(),
    });
  });
}

function buildCompactRows(params: {
  clinicianId: string;
  wallets: Prisma.ClinicianCompactWalletGetPayload<{}>[];
  status: Prisma.CompactsStatusGetPayload<{}> | null;
  eligibility: Prisma.CompactEligibilityGetPayload<{}>[];
  issuerDirectory: IssuerDirectory;
  now: Date;
}): MasterIndexRow[] {
  const { clinicianId, wallets, status, eligibility, issuerDirectory, now } = params;
  const eligibleByCompact = new Map<string, Prisma.CompactEligibilityGetPayload<{}>>();
  eligibility.forEach((entry) => eligibleByCompact.set(entry.compact, entry));

  return wallets.map((wallet) => {
    const elig = eligibleByCompact.get(wallet.compactType);
    const statusText =
      elig?.eligible === false
        ? 'revoked'
        : wallet.privileges?.length
          ? 'active'
          : 'expired';
    const summary = {
      label: `${wallet.compactType} compact`,
      compactType: wallet.compactType,
      homeState: wallet.homeState,
      privileges: wallet.privileges ?? [],
      status: statusText,
      lastComputedAt: status?.lastComputedAt?.toISOString() ?? wallet.updatedAt?.toISOString() ?? null,
      rationale: elig?.rationale ?? null,
    };

    const timeline: IndexTimelineEvent[] = [];
    if (status?.lastComputedAt) {
      timeline.push({
        label: 'Eligibility computed',
        occurredAt: status.lastComputedAt.toISOString(),
        status: statusText as IndexStatus,
      });
    }
    if (status?.nextRefreshAt) {
      timeline.push({
        label: 'Next refresh',
        occurredAt: status.nextRefreshAt.toISOString(),
        status: 'active',
      });
    }
    if (wallet.updatedAt) {
      timeline.push({
        label: 'Wallet updated',
        occurredAt: wallet.updatedAt.toISOString(),
        status: statusText as IndexStatus,
      });
    }

    return buildRow({
      clinicianId,
      credentialId: wallet.id,
      credentialType: 'compact',
      issuerDid: resolveIssuerDid(
        issuerDirectory,
        wallet.compactType,
        DEFAULT_ISSUERS.compact,
      ),
      status: statusText as IndexStatus,
      summary,
      timeline,
      lastUpdated:
        wallet.updatedAt?.toISOString() ??
        status?.lastComputedAt?.toISOString() ??
        now.toISOString(),
    });
  });
}

function deriveStatusFromLicense(
  license: Prisma.StateLicenseVerificationGetPayload<{}>,
  now: Date,
): IndexStatus {
  if ((license as any).disciplinaryFlag) {
    return 'revoked';
  }
  const normalized = (license.status ?? '').toUpperCase();
  if (['REVOKED', 'SUSPENDED', 'PROBATION'].includes(normalized)) {
    return 'revoked';
  }
  return deriveStatusFromDate(license.expiryDate ?? null, now);
}

function deriveStatusFromCredential(
  credential: Prisma.CredentialGetPayload<{}>,
  now: Date,
): IndexStatus {
  const normalized = (credential.status ?? '').toUpperCase();
  if (['REVOKED', 'SUSPENDED', 'TERMINATED'].includes(normalized)) {
    return 'revoked';
  }
  return deriveStatusFromDate(credential.expiresAt ?? null, now);
}

function deriveStatusFromDate(date: Date | null, now: Date): IndexStatus {
  if (!date) {
    return 'active';
  }
  return date.getTime() < now.getTime() ? 'expired' : 'active';
}

function buildRow(params: {
  clinicianId: string;
  credentialId: string;
  credentialType: IndexCredentialType;
  issuerDid: string;
  status: IndexStatus;
  summary: Record<string, unknown>;
  timeline: IndexTimelineEvent[];
  lastUpdated?: string;
}): MasterIndexRow {
  const lastUpdated = params.lastUpdated ?? new Date().toISOString();
  const payloadCore = {
    clinicianId: params.clinicianId,
    credentialType: params.credentialType,
    credentialId: params.credentialId,
    issuerDid: params.issuerDid,
    status: params.status,
    summary: params.summary,
    timeline: params.timeline,
    lastUpdated,
  };

  const hash = createHash('sha256')
    .update(
      JSON.stringify({
        clinicianId: payloadCore.clinicianId,
        credentialType: payloadCore.credentialType,
        credentialId: payloadCore.credentialId,
        issuerDid: payloadCore.issuerDid,
        status: payloadCore.status,
        lastUpdated: payloadCore.lastUpdated,
      }),
    )
    .digest('hex');

  return {
    ...payloadCore,
    hash,
  };
}

function buildStatusSummary(rows: MasterIndexRow[]): IndexStatusSummary {
  const summary = {
    total: rows.length,
    byStatus: {
      active: 0,
      expired: 0,
      revoked: 0,
    } as Record<IndexStatus, number>,
    byType: {
      license: 0,
      board: 0,
      employment: 0,
      dea_mate: 0,
      compact: 0,
    } as Record<IndexCredentialType, number>,
  };

  for (const row of rows) {
    summary.byStatus[row.status] += 1;
    summary.byType[row.credentialType] += 1;
  }

  return summary;
}

async function persistRows(
  client: PrismaClient,
  clinicianId: string,
  rows: MasterIndexRow[],
) {
  await client.$transaction([
    client.masterCredentialIndex.deleteMany({ where: { clinicianId } }),
    ...(rows.length
      ? [
          client.masterCredentialIndex.createMany({
            data: rows.map((row) => ({
              clinicianId,
              credentialType: row.credentialType,
              credentialId: row.credentialId,
              issuerDid: row.issuerDid,
              status: row.status,
              lastUpdated: new Date(row.lastUpdated),
            })),
          }),
        ]
      : []),
  ]);
}

interface IssuerDirectory {
  byOrg: Map<string, string>;
  byDid: Set<string>;
}

function buildIssuerDirectory(entries: TrustedIssuer[]): IssuerDirectory {
  const byOrg = new Map<string, string>();
  const byDid = new Set<string>();
  entries.forEach((entry) => {
    if (entry.orgName) {
      byOrg.set(entry.orgName.trim().toLowerCase(), entry.did);
    }
    if (entry.did) {
      byDid.add(entry.did);
    }
  });
  return { byOrg, byDid };
}

function resolveIssuerDid(
  directory: IssuerDirectory,
  hint: string | null | undefined,
  fallback: string,
): string {
  if (!hint) {
    return fallback;
  }
  const trimmed = hint.trim();
  if (!trimmed) {
    return fallback;
  }
  if (trimmed.startsWith('did:')) {
    return trimmed;
  }
  const normalized = trimmed.toLowerCase();
  return directory.byOrg.get(normalized) ?? fallback;
}

function extractIssuerHint(value: Prisma.JsonValue | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.id === 'string') {
      return obj.id;
    }
    if (typeof obj.name === 'string') {
      return obj.name;
    }
  }
  return null;
}

function buildLicenseLabel(license: Prisma.StateLicenseVerificationGetPayload<{}>): string {
  const state = license.state ?? 'Unknown state';
  const number = license.licenseNumber ?? 'Unknown license';
  return `${state} · ${number}`;
}


