import { createHash } from 'node:crypto';
import type { NpiDidBinding, NpiDidBindingStatus, Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import {
  createTraceId,
  emitAnalyticsEvent,
  emitAuditEvent,
} from '../audit/auditService';

const NPI_PATTERN = /^\d{10}$/;
const DID_RECIPE_VERSION = '1.0.0';
const DID_DERIVATION_SUFFIX = ':vitalcv-identity-v1';
const NPPES_API_URL = 'https://npiregistry.cms.hhs.gov/api/?version=2.1';
const NPI_FINGERPRINT_VERSION = 'npi-fingerprint-v1';
const CONTEST_WINDOW_MS = 24 * 60 * 60 * 1000;
const SYSTEM_ACTOR_DID = 'did:vitalcv:system:vitalcv-core';

type BindingAuditEventType =
  | 'IDENTITY_BINDING_CREATED'
  | 'IDENTITY_BINDING_CONTESTED'
  | 'IDENTITY_BINDING_REVOKED';

export type NpiEvidencePointer = {
  type: string;
  url: string;
  fetchedAt: string;
  checksum: string;
};

type NppesLookupResponse = {
  result_count?: number;
  results?: unknown[];
};

type NppesSnapshot = {
  record: Record<string, unknown> | null;
  evidence: NpiEvidencePointer[];
};

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeNpi(npi: string): string {
  const normalized = npi.trim();
  if (!NPI_PATTERN.test(normalized)) {
    throw new Error('NPI must be exactly 10 digits');
  }
  return normalized;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeFingerprintValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeFingerprintValue(entry));
  }

  if (isPlainRecord(value)) {
    return Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = normalizeFingerprintValue(value[key]);
        return accumulator;
      }, {});
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase();
  }

  return value;
}

function coerceEvidencePointers(value: Prisma.JsonValue | null | undefined): NpiEvidencePointer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isPlainRecord(entry)) {
      return [];
    }

    const type = typeof entry.type === 'string' ? entry.type : '';
    const url = typeof entry.url === 'string' ? entry.url : '';
    const fetchedAt = typeof entry.fetchedAt === 'string' ? entry.fetchedAt : '';
    const checksum = typeof entry.checksum === 'string' ? entry.checksum : '';

    if (!type || !url || !fetchedAt || !checksum) {
      return [];
    }

    return [{ type, url, fetchedAt, checksum }];
  });
}

async function fetchNppesSnapshot(npi: string): Promise<NppesSnapshot> {
  const normalizedNpi = normalizeNpi(npi);
  const url = `${NPPES_API_URL}&number=${encodeURIComponent(normalizedNpi)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'VitalCV/1.0 (identity-binding)',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      log('warn', 'npi_did_binding_nppes_http_error', {
        npi: normalizedNpi,
        status: response.status,
      });
      return { record: null, evidence: [] };
    }

    const rawResponse = await response.text();
    let payload: NppesLookupResponse;
    try {
      payload = JSON.parse(rawResponse) as NppesLookupResponse;
    } catch (error) {
      log('warn', 'npi_did_binding_nppes_invalid_json', {
        npi: normalizedNpi,
        error: error instanceof Error ? error.message : String(error),
      });
      return { record: null, evidence: [] };
    }

    if (
      !Array.isArray(payload.results) ||
      payload.result_count === 0 ||
      payload.results.length === 0 ||
      !isPlainRecord(payload.results[0])
    ) {
      log('warn', 'npi_did_binding_nppes_not_found', { npi: normalizedNpi });
      return { record: null, evidence: [] };
    }

    return {
      record: payload.results[0],
      evidence: [{
        type: 'NPPES_API',
        url,
        fetchedAt: new Date().toISOString(),
        checksum: sha256Hex(rawResponse),
      }],
    };
  } catch (error) {
    log('warn', 'npi_did_binding_nppes_fetch_failed', {
      npi: normalizedNpi,
      error: error instanceof Error ? error.message : String(error),
    });
    return { record: null, evidence: [] };
  }
}

async function emitBindingLifecycleEvent(
  type: BindingAuditEventType,
  binding: NpiDidBinding,
  severity: 'INFO' | 'CRITICAL',
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const traceId = createTraceId();
  const auditMetadata = {
    npi: binding.npi,
    did: binding.did,
    bindingId: binding.id,
    status: binding.status,
    recipeVersion: binding.recipeVersion,
    fingerprintRecipeVersion: NPI_FINGERPRINT_VERSION,
    ...metadata,
  };

  await emitAnalyticsEvent({
    type,
    referenceId: binding.id,
    clinicianId: binding.npi,
    metadata: auditMetadata,
  });

  emitAuditEvent({
    traceId,
    category: ['VERIFICATION', 'SYSTEM'],
    actor: SYSTEM_ACTOR_DID,
    resource: binding.did,
    requestFields: {
      npi: binding.npi,
      did: binding.did,
      recipeVersion: binding.recipeVersion,
      fingerprintRecipeVersion: NPI_FINGERPRINT_VERSION,
    },
    resultFields: auditMetadata,
    severity,
  });
}

async function emitBindingUpdateAudit(
  binding: NpiDidBinding,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  emitAuditEvent({
    traceId: createTraceId(),
    category: ['VERIFICATION', 'SYSTEM'],
    actor: SYSTEM_ACTOR_DID,
    resource: binding.did,
    requestFields: {
      npi: binding.npi,
      did: binding.did,
      recipeVersion: binding.recipeVersion,
      fingerprintRecipeVersion: NPI_FINGERPRINT_VERSION,
    },
    resultFields: {
      bindingId: binding.id,
      status: binding.status,
      sourceFingerprint: binding.sourceFingerprint,
      ...metadata,
    },
    severity: 'INFO',
  });
}

export function deriveDidFromNpi(npi: string): string {
  const normalizedNpi = normalizeNpi(npi);
  const suffix = sha256Hex(`${normalizedNpi}${DID_DERIVATION_SUFFIX}`).slice(0, 32);
  return `did:vitalcv:npi:${suffix}`;
}

export function fingerprintNppesRecord(record: Record<string, unknown>): string {
  const normalized = normalizeFingerprintValue(record);
  return sha256Hex(JSON.stringify(normalized));
}

export async function collectNpiEvidence(npi: string): Promise<NpiEvidencePointer[]> {
  const snapshot = await fetchNppesSnapshot(npi);
  return snapshot.evidence;
}

export async function getBindingByNpi(npi: string): Promise<NpiDidBinding | null> {
  return prisma.npiDidBinding.findUnique({
    where: { npi: normalizeNpi(npi) },
  });
}

export async function getBindingByDid(did: string): Promise<NpiDidBinding | null> {
  return prisma.npiDidBinding.findUnique({
    where: { did: did.trim() },
  });
}

export async function listContestedBindings(): Promise<NpiDidBinding[]> {
  return prisma.npiDidBinding.findMany({
    where: { status: 'CONTESTED' },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function detectContestedBinding(npi: string, newFingerprint: string): Promise<boolean> {
  const existing = await getBindingByNpi(npi);
  if (!existing || existing.sourceFingerprint === newFingerprint) {
    return false;
  }

  await emitBindingLifecycleEvent(
    'IDENTITY_BINDING_CONTESTED',
    existing,
    'CRITICAL',
    {
      previousFingerprint: existing.sourceFingerprint,
      newFingerprint,
      contestReason: 'source_fingerprint_mismatch',
    },
  );

  return true;
}

export async function createOrUpdateBinding(npi: string): Promise<NpiDidBinding> {
  const normalizedNpi = normalizeNpi(npi);
  const existing = await getBindingByNpi(normalizedNpi);
  const snapshot = await fetchNppesSnapshot(normalizedNpi);
  const did = deriveDidFromNpi(normalizedNpi);

  const sourceFingerprint = snapshot.record
    ? fingerprintNppesRecord(snapshot.record)
    : existing?.sourceFingerprint ?? fingerprintNppesRecord({ number: normalizedNpi });

  const contested = await detectContestedBinding(normalizedNpi, sourceFingerprint);
  const contestRecent = !!existing &&
    contested &&
    Date.now() - existing.updatedAt.getTime() < CONTEST_WINDOW_MS;

  let status: NpiDidBindingStatus = existing?.status ?? 'ACTIVE';
  let contestReason = existing?.contestReason ?? null;

  if (!existing) {
    status = 'ACTIVE';
    contestReason = null;
  } else if (existing.status === 'REVOKED' || existing.status === 'PENDING' || existing.status === 'CONTESTED') {
    status = existing.status;
    contestReason = existing.contestReason ?? contestReason;
  } else if (contestRecent) {
    status = 'CONTESTED';
    contestReason = 'source_fingerprint_changed_within_24h';
  } else {
    status = 'ACTIVE';
    contestReason = null;
  }

  const evidencePointers = (
    snapshot.evidence.length > 0
      ? snapshot.evidence
      : coerceEvidencePointers(existing?.evidencePointers)
  ) as Prisma.InputJsonValue;

  const binding = await prisma.npiDidBinding.upsert({
    where: { npi: normalizedNpi },
    update: {
      did,
      sourceFingerprint,
      recipeVersion: DID_RECIPE_VERSION,
      evidencePointers,
      status,
      contestReason,
    },
    create: {
      npi: normalizedNpi,
      did,
      sourceFingerprint,
      recipeVersion: DID_RECIPE_VERSION,
      evidencePointers,
      status,
      contestReason,
    },
  });

  if (!existing) {
    await emitBindingLifecycleEvent('IDENTITY_BINDING_CREATED', binding, 'INFO', {
      sourceFingerprint,
      evidenceCount: snapshot.evidence.length,
    });
  } else if (!(contestRecent && existing.status !== 'CONTESTED')) {
    await emitBindingUpdateAudit(binding, {
      sourceFingerprint,
      evidenceCount: snapshot.evidence.length,
      contested,
    });
  }

  return binding;
}
