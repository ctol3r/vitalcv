import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { differenceInDays, differenceInMonths } from 'date-fns';
import { anchorCredentialFabricSnapshot } from '../audit/anchor';

type ExtendedPrisma = PrismaClient & Record<string, any>;

const prisma = new PrismaClient();
const DEFAULT_ACTOR = process.env.SYSTEM_ACTOR ?? 'system';
const CONFLICT_THRESHOLD_DAYS = Number(process.env.FABRIC_CONFLICT_THRESHOLD_DAYS ?? 7);

export interface FabricIntegrityReport {
  overall: 'pass' | 'warning' | 'fail';
  signatureChain: {
    ok: boolean;
    issues: string[];
  };
  expirations: {
    ok: boolean;
    expiringSoon: number;
    expired: number;
  };
  revocations: {
    ok: boolean;
    revokedCount: number;
    orphanedCredentials: number;
  };
}

export interface FabricConflict {
  id: string;
  type: 'status_mismatch' | 'expiration_mismatch' | 'missing_audit' | 'orphan_vc';
  severity: 'low' | 'medium' | 'high';
  summary: string;
  details?: Record<string, unknown>;
}

export interface CredentialFabricSnapshot {
  clinicianId: string;
  version: number;
  status: string;
  generatedAt: string;
  fabric: Record<string, unknown>;
  integrity: FabricIntegrityReport;
  conflicts: FabricConflict[];
  crossChain?: Record<string, unknown> | null;
  diff?: FabricDiffEntry[];
  anchor?: {
    txHash: string;
    network: string;
    timestamp: string;
  } | null;
}

export interface FabricDiffEntry {
  path: string;
  previous: unknown;
  next: unknown;
}

interface BuildOptions {
  prisma?: PrismaClient;
  actor?: string;
  reason?: string;
  skipAnchor?: boolean;
  force?: boolean;
}

export async function generateCredentialFabric(clinicianId: string, options: BuildOptions = {}) {
  if (!clinicianId) {
    throw new Error('clinicianId is required to generate credential fabric');
  }

  const client = (options.prisma ?? prisma) as ExtendedPrisma;
  const actor = options.actor ?? DEFAULT_ACTOR;

  const previous = await client.credentialFabric.findUnique({ where: { clinicianId } });
  if (!options.force && previous && previous.status === 'stable') {
    // Avoid regenerating unless forced or previous snapshot is stale.
    const ageDays = differenceInDays(new Date(), new Date(previous.updatedAt));
    if (ageDays < 1) {
      return mapRecordToSnapshot(previous);
    }
  }

  const sources = await fetchFabricSources(client, clinicianId);
  const issuerVcs = mergeIssuerCredentials(sources.walletCredentials);
  const fabricPayload = {
    clinicianId,
    generatedAt: new Date().toISOString(),
    stateBoards: sources.stateBoards,
    npi: sources.npi,
    issuerVcs,
    auditTrail: sources.auditTrail,
    lineage: buildLineageSummary(sources.stateBoards, issuerVcs),
  };

  const integrity = evaluateIntegrity(fabricPayload);
  const conflicts = detectConflicts(fabricPayload);
  const crossChain = buildCrossChainProof(fabricPayload);
  const status = conflicts.length ? 'conflict' : integrity.overall === 'fail' ? 'degraded' : 'stable';
  const version = (previous?.version ?? 0) + 1;
  const diff = previous ? diffFabric(previous.fabric, fabricPayload) : [];

  const record = previous
    ? await client.credentialFabric.update({
        where: { clinicianId },
        data: {
          fabric: fabricPayload,
          version,
          status,
          integrity,
          conflicts,
          crossChain,
          anchorTxHash: crossChain?.anchor?.txHash ?? null,
        },
      })
    : await client.credentialFabric.create({
        data: {
          clinicianId,
          fabric: fabricPayload,
          version,
          status,
          integrity,
          conflicts,
          crossChain,
          anchorTxHash: crossChain?.anchor?.txHash ?? null,
        },
      });

  if (diff.length) {
    await client.credentialFabricDiff.create({
      data: {
        fabricId: record.id,
        clinicianId,
        version,
        previousVersion: previous?.version ?? null,
        diff,
        actor,
        reason: options.reason ?? (previous ? 'auto_refresh' : 'bootstrap'),
      },
    });
  }

  await client.credentialFabricEvent.create({
    data: {
      fabricId: record.id,
      clinicianId,
      fabricVersion: version,
      eventType: 'snapshotGenerated',
      payload: {
        status,
        diff,
        conflicts,
        integrity,
        lineage: fabricPayload.lineage,
      },
      replayHash: hashValue(diff.map((entry) => `${entry.path}:${entry.next}`)),
    },
  });

  let anchor = null;
  if (!options.skipAnchor) {
    anchor = anchorCredentialFabricSnapshot({
      clinicianId,
      version,
      componentCount: fabricPayload.stateBoards.length + issuerVcs.length,
      conflictCount: conflicts.length,
      integrityScore: integrity.overall === 'fail' ? 0 : integrity.overall === 'warning' ? 0.6 : 0.95,
      crossChainRoot: crossChain?.root ?? null,
    });
  }

  return {
    ...mapRecordToSnapshot(record),
    diff,
    anchor,
  } satisfies CredentialFabricSnapshot;
}

export async function getCredentialFabricSnapshot(
  clinicianId: string,
  options: { prisma?: PrismaClient; refresh?: boolean } = {},
) {
  if (options.refresh) {
    return generateCredentialFabric(clinicianId, { prisma: options.prisma, force: true });
  }
  const client = (options.prisma ?? prisma) as ExtendedPrisma;
  const record = await client.credentialFabric.findUnique({ where: { clinicianId } });
  if (!record) return null;
  return mapRecordToSnapshot(record);
}

export async function listCredentialFabricDiffs(
  clinicianId: string,
  options: { prisma?: PrismaClient; limit?: number } = {},
) {
  const client = (options.prisma ?? prisma) as ExtendedPrisma;
  const diffs = await client.credentialFabricDiff.findMany({
    where: { clinicianId },
    orderBy: { mutatedAt: 'desc' },
    take: Math.min(options.limit ?? 20, 100),
  });
  return diffs.map((entry: any) => ({
    id: entry.id,
    version: entry.version,
    previousVersion: entry.previousVersion,
    diff: entry.diff as FabricDiffEntry[],
    mutatedAt: new Date(entry.mutatedAt).toISOString(),
    actor: entry.actor ?? DEFAULT_ACTOR,
    reason: entry.reason ?? 'update',
  }));
}

export async function replayCredentialFabricEvents(
  clinicianId: string,
  options: { prisma?: PrismaClient; upToVersion?: number } = {},
) {
  const client = (options.prisma ?? prisma) as ExtendedPrisma;
  const events = await client.credentialFabricEvent.findMany({
    where: {
      clinicianId,
      ...(options.upToVersion ? { fabricVersion: { lte: options.upToVersion } } : {}),
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!events.length) return null;

  let replayed: Record<string, unknown> = {};
  events.forEach((event: any) => {
    if (Array.isArray(event.payload?.diff)) {
      replayed = applyDiff(replayed, event.payload.diff as FabricDiffEntry[]);
    } else if (event.payload?.status && event.payload?.lineage) {
      replayed = {
        status: event.payload.status,
        lineage: event.payload.lineage,
      };
    }
  });

  return {
    clinicianId,
    version: events[events.length - 1].fabricVersion,
    status: events[events.length - 1].payload?.status ?? 'unknown',
    generatedAt: new Date(events[events.length - 1].createdAt).toISOString(),
    fabric: replayed,
    integrity: events[events.length - 1].payload?.integrity ?? {
      overall: 'warning',
      signatureChain: { ok: false, issues: ['no_snapshot'] },
      expirations: { ok: false, expiringSoon: 0, expired: 0 },
      revocations: { ok: false, revokedCount: 0, orphanedCredentials: 0 },
    },
    conflicts: events[events.length - 1].payload?.conflicts ?? [],
    crossChain: null,
    anchor: null,
  } satisfies CredentialFabricSnapshot;
}

function mapRecordToSnapshot(record: any): CredentialFabricSnapshot {
  return {
    clinicianId: record.clinicianId,
    version: record.version,
    status: record.status,
    generatedAt: new Date(record.updatedAt ?? record.createdAt ?? new Date()).toISOString(),
    fabric: record.fabric ?? {},
    integrity: record.integrity ?? {
      overall: 'warning',
      signatureChain: { ok: false, issues: [] },
      expirations: { ok: false, expiringSoon: 0, expired: 0 },
      revocations: { ok: false, revokedCount: 0, orphanedCredentials: 0 },
    },
    conflicts: record.conflicts ?? [],
    crossChain: record.crossChain ?? null,
    anchor: record.anchorTxHash
      ? {
          txHash: record.anchorTxHash,
          network: record.crossChain?.anchor?.network ?? 'pilot-l2',
          timestamp: record.crossChain?.anchor?.timestamp ?? record.updatedAt?.toISOString?.() ?? new Date().toISOString(),
        }
      : null,
  };
}

async function fetchFabricSources(client: ExtendedPrisma, clinicianId: string) {
  const [stateBoards, npiRecord, walletCredentials, auditEvidence, auditProofs] = await Promise.all([
    client.stateLicenseVerification.findMany({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
    client.nPIValidation.findFirst({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
    }),
    client.walletCredential.findMany({
      where: { clinicianId },
      orderBy: { issuedAt: 'desc' },
      take: 100,
    }),
    client.auditEvidence.findMany({
      where: { clinicianId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    client.auditProof.findMany({
      where: { eventId: { contains: clinicianId } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  return {
    stateBoards: stateBoards.map(mapStateBoardRecord),
    npi: npiRecord
      ? {
          npi: npiRecord.npi,
          score: npiRecord.score,
          crossRefs: npiRecord.crossRefs,
          updatedAt: npiRecord.updatedAt?.toISOString?.() ?? new Date().toISOString(),
        }
      : null,
    walletCredentials,
    auditTrail: auditEvidence.map((entry: any) => ({
      id: entry.id,
      category: entry.category,
      hash: hashValue(entry.payload),
      createdAt: entry.createdAt?.toISOString?.() ?? new Date().toISOString(),
    })),
    auditProofs,
  };
}

function mapStateBoardRecord(record: any) {
  return {
    id: record.id,
    state: record.state ?? 'UNK',
    licenseNumber: record.licenseNumber ?? record.id,
    status: record.status ?? 'UNKNOWN',
    issueDate: record.issueDate?.toISOString?.() ?? null,
    expiryDate: record.expiryDate?.toISOString?.() ?? null,
    updatedAt: record.updatedAt?.toISOString?.() ?? record.verifiedAt?.toISOString?.() ?? null,
    metadata: record.metadata ?? {},
  };
}

function mergeIssuerCredentials(walletCredentials: any[]) {
  const merged: Record<
    string,
    {
      credentialId: string;
      issuer: string;
      status: string;
      issuedAt: string | null;
      expiresAt: string | null;
      payload: Record<string, unknown>;
      updates: Array<{ at: string; delta: Record<string, unknown> }>;
      anchor?: string | null;
    }
  > = {};

  walletCredentials.forEach((credential) => {
    const issuer =
      (credential.payload?.issuer as string | undefined) ??
      (credential.payload?.credentialIssuer as string | undefined) ??
      'did:web:vitalcv.issuer';
    const key = `${issuer}:${credential.type}`;
    const existing = merged[key];
    const updateEntry = {
      credentialId: credential.credentialId,
      delta: credential.payload ?? {},
      at: credential.updatedAt?.toISOString?.() ?? credential.issuedAt?.toISOString?.() ?? new Date().toISOString(),
    };
    if (!existing) {
      merged[key] = {
        credentialId: credential.credentialId,
        issuer,
        status: credential.revokedAt ? 'revoked' : 'active',
        issuedAt: credential.issuedAt?.toISOString?.() ?? null,
        expiresAt: credential.revokedAt?.toISOString?.() ?? credential.payload?.expiresAt ?? null,
        payload: credential.payload ?? {},
        updates: [updateEntry],
        anchor: credential.payload?.anchorTxHash ?? null,
      };
    } else {
      existing.payload = {
        ...existing.payload,
        ...credential.payload,
      };
      existing.status = credential.revokedAt ? 'revoked' : existing.status;
      existing.expiresAt =
        credential.payload?.expiresAt ?? existing.expiresAt ?? credential.revokedAt?.toISOString?.() ?? null;
      existing.updates.push(updateEntry);
    }
  });

  return Object.values(merged);
}

function buildLineageSummary(stateBoards: any[], issuerVcs: any[]) {
  const states = new Set(stateBoards.map((board) => board.state));
  const issuers = new Set(issuerVcs.map((vc) => vc.issuer));
  return {
    jurisdictions: Array.from(states),
    issuers: Array.from(issuers),
    lastUpdated:
      stateBoards[0]?.updatedAt ??
      issuerVcs[0]?.issuedAt ??
      new Date().toISOString(),
    componentCount: stateBoards.length + issuerVcs.length,
  };
}

function evaluateIntegrity(payload: {
  stateBoards: any[];
  issuerVcs: any[];
}) {
  const stateBoards = payload.stateBoards ?? [];
  const issuerVcs = payload.issuerVcs ?? [];

  const signatureIssues = issuerVcs
    .filter((vc) => !Boolean(vc.anchor))
    .map((vc) => `VC ${vc.credentialId} missing anchor`);

  const expiringSoon = stateBoards.filter((board) => isExpiringSoon(board.expiryDate)).length;
  const expired = stateBoards.filter((board) => isExpired(board.expiryDate)).length;

  const revoked = issuerVcs.filter((vc) => vc.status === 'revoked').length;
  const orphaned = issuerVcs.filter(
    (vc) => vc.status === 'active' && !stateBoards.some((board) => board.state === vc.payload?.state),
  ).length;

  const integrity: FabricIntegrityReport = {
    overall: 'pass',
    signatureChain: { ok: signatureIssues.length === 0, issues: signatureIssues },
    expirations: { ok: expired === 0, expiringSoon, expired },
    revocations: { ok: revoked === 0, revokedCount: revoked, orphanedCredentials: orphaned },
  };

  if (!integrity.signatureChain.ok || !integrity.expirations.ok || !integrity.revocations.ok) {
    integrity.overall =
      expired > 0 || revoked > 0 ? 'fail' : signatureIssues.length > 0 || expiringSoon > 0 ? 'warning' : 'pass';
  }
  return integrity;
}

function detectConflicts(payload: { stateBoards: any[]; issuerVcs: any[] }) {
  const conflicts: FabricConflict[] = [];
  payload.stateBoards.forEach((board) => {
    if (board.status?.toLowerCase?.() === 'expired') {
      conflicts.push({
        id: `state-${board.id}`,
        type: 'expiration_mismatch',
        severity: 'high',
        summary: `${board.state} license ${board.licenseNumber} is expired`,
        details: board,
      });
    } else if (board.status?.toLowerCase?.() === 'probation') {
      conflicts.push({
        id: `state-${board.id}-status`,
        type: 'status_mismatch',
        severity: 'medium',
        summary: `${board.state} license ${board.licenseNumber} is on probation`,
        details: board,
      });
    }
  });

  payload.issuerVcs.forEach((vc) => {
    const board = payload.stateBoards.find((state) => state.state === vc.payload?.state);
    if (!board) {
      conflicts.push({
        id: `vc-${vc.credentialId}-orphan`,
        type: 'orphan_vc',
        severity: 'medium',
        summary: `Issuer VC ${vc.credentialId} references ${vc.payload?.state ?? 'unknown'} with no state evidence`,
        details: vc,
      });
      return;
    }
    const boardExpiry = board.expiryDate ? new Date(board.expiryDate) : null;
    const vcExpiry = vc.expiresAt ? new Date(vc.expiresAt) : null;
    if (boardExpiry && vcExpiry && Math.abs(boardExpiry.getTime() - vcExpiry.getTime()) > CONFLICT_THRESHOLD_DAYS * 86400000) {
      conflicts.push({
        id: `vc-${vc.credentialId}-expiry`,
        type: 'expiration_mismatch',
        severity: 'low',
        summary: `Issuer VC ${vc.credentialId} expiry (${vc.expiresAt}) diverges from board (${board.expiryDate})`,
        details: { board, vc },
      });
    }
  });

  return conflicts;
}

function diffFabric(previous: Record<string, unknown>, next: Record<string, unknown>, prefix = ''): FabricDiffEntry[] {
  const diffs: FabricDiffEntry[] = [];
  const keys = new Set([...Object.keys(previous ?? {}), ...Object.keys(next ?? {})]);
  keys.forEach((key) => {
    const prevValue = (previous ?? {})[key];
    const nextValue = (next ?? {})[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof prevValue === 'object' && typeof nextValue === 'object' && prevValue && nextValue) {
      diffs.push(...diffFabric(prevValue as Record<string, unknown>, nextValue as Record<string, unknown>, path));
    } else if (JSON.stringify(prevValue) !== JSON.stringify(nextValue)) {
      diffs.push({
        path,
        previous: prevValue,
        next: nextValue,
      });
    }
  });
  return diffs;
}

function applyDiff(base: Record<string, unknown>, diff: FabricDiffEntry[]) {
  const clone = { ...base };
  diff.forEach((entry) => {
    const segments = entry.path.split('.');
    let cursor: any = clone;
    for (let i = 0; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      cursor[segment] = cursor[segment] ?? {};
      cursor = cursor[segment];
    }
    cursor[segments[segments.length - 1]] = entry.next;
  });
  return clone;
}

function isExpiringSoon(expiry?: string | null) {
  if (!expiry) return false;
  const delta = differenceInMonths(new Date(expiry), new Date());
  return delta >= 0 && delta <= 1;
}

function isExpired(expiry?: string | null) {
  if (!expiry) return false;
  return new Date(expiry) < new Date();
}

function buildCrossChainProof(fabric: Record<string, unknown>) {
  const root = hashValue(fabric);
  const evmProof = `0x${createHash('sha256').update(`${root}:evm`).digest('hex')}`;
  const cosmosProof = `0x${createHash('sha256').update(`${root}:cosmos`).digest('hex')}`;
  return {
    root,
    anchor: {
      txHash: evmProof,
      network: 'fabric-l2',
      timestamp: new Date().toISOString(),
    },
    evm: {
      proof: evmProof,
      chainId: process.env.FABRIC_EVM_CHAIN_ID ?? '11155111',
    },
    cosmos: {
      proof: cosmosProof,
      chainId: process.env.FABRIC_COSMOS_CHAIN_ID ?? 'vital-cosmos-hub',
    },
  };
}

function hashValue(value: unknown) {
  const normalized = typeof value === 'string' ? value : JSON.stringify(value);
  return createHash('sha256').update(normalized).digest('hex');
}

