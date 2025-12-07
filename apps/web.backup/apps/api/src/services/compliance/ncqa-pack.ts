import {
  Prisma,
  PrismaClient,
  type AuditEvidence,
  type ComplianceCheck,
  type CaqhProfile,
  type DEACredential,
  type EvidencePack as EvidencePackModel,
  type ProcedureVolume,
  type StateLicenseVerification,
} from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { differenceInCalendarDays } from 'date-fns';

import { anchorEvidencePack, listAnchorEvents, type AnchorRecord } from '../audit/anchor';
import { validateMateTraining } from '../dea/mate-validator';
import { parseCaqhProfileFields, type CaqhProfileFields } from '@/services/payer/models/CAQHProfile';

const prisma = new PrismaClient();
const PACK_VERSION = '132.0.0';
const NCQA_CATEGORIES = ['CR1', 'CR2', 'CR3', 'CR4', 'CR5'] as const;
const NCQA_COMPLIANCE_TYPES = ['license', 'sanctions', 'npdb', 'expiry'] as const;

export type EvidencePackType = 'ncqa-cr' | 'dea-mate' | 'tjc-psv';

type ClinicianSummary = {
  id: string;
  orgId: string | null;
  name: string | null;
  email: string | null;
  npi: string | null;
  state: string | null;
};

export interface EvidenceDelta {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  detectedAt: string;
  details?: Record<string, unknown>;
}

export interface AnchorSummary {
  type: string;
  txHash: string;
  network: string;
  timestamp: string;
  merkleRoot: string;
}

export interface EvidencePackItem {
  key: string;
  label: string;
  type: string;
  capturedAt: string | null;
  source: string;
  hash: string;
  payload: Record<string, unknown>;
}

export interface EvidenceManifest {
  hash: string;
  formatVersion: string;
  packId: string;
  packType: EvidencePackType;
  generatedAt: string;
  clinician: ClinicianSummary;
  summary: {
    itemCount: number;
    warningCount: number;
    deltaCodes: string[];
    latestAnchor?: string | null;
  };
  items: Array<Pick<EvidencePackItem, 'key' | 'label' | 'type' | 'capturedAt' | 'source' | 'hash'>>;
  warnings: EvidenceDelta[];
  anchors: AnchorSummary[];
}

export interface EvidencePackShare {
  shareId: string;
  shareToken: string;
  recipientOrgId: string | null;
  channel: 'api' | 'manual';
  createdAt: string;
  expiresAt: string;
}

export interface EvidencePackPayload {
  packId: string;
  packType: EvidencePackType;
  clinicianId: string;
  clinician: ClinicianSummary;
  formatVersion: string;
  generatedAt: string;
  items: EvidencePackItem[];
  warnings: EvidenceDelta[];
  anchors: AnchorSummary[];
  manifest: EvidenceManifest;
  manifestYaml: string;
  shareHistory?: EvidencePackShare[];
}

export interface EvidencePackBuildResult {
  packId: string;
  packType: EvidencePackType;
  manifest: EvidenceManifest;
  manifestYaml: string;
  warnings: EvidenceDelta[];
  anchors: AnchorSummary[];
  record: EvidencePackModel;
  payload: EvidencePackPayload;
}

export interface BuildPackOptions {
  prisma?: PrismaClient;
}

export interface RegisterShareOptions {
  recordId: string;
  recipientOrgId?: string | null;
  expiresInHours?: number;
  channel?: 'api' | 'manual';
  prisma?: PrismaClient;
}

export async function generateEvidencePack(
  clinicianId: string,
  packType: EvidencePackType,
  options: BuildPackOptions = {}
): Promise<EvidencePackBuildResult> {
  const client = options.prisma ?? prisma;
  switch (packType) {
    case 'ncqa-cr':
      return buildNcqaEvidencePack(clinicianId, client);
    case 'dea-mate':
      return buildDeaEvidencePack(clinicianId, client);
    case 'tjc-psv':
      return buildJointCommissionPack(clinicianId, client);
    default:
      throw new Error(`Unsupported evidence pack type: ${packType}`);
  }
}

export async function registerEvidencePackShare(
  options: RegisterShareOptions
): Promise<{ share: EvidencePackShare; payload: EvidencePackPayload; record: EvidencePackModel }> {
  const client = options.prisma ?? prisma;
  const record = await client.evidencePack.findUnique({ where: { id: options.recordId } });
  if (!record) {
    throw new Error(`Evidence pack ${options.recordId} not found`);
  }

  const payload = parseEvidencePackPayload(record);
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + (options.expiresInHours ?? 24) * 60 * 60 * 1000);
  const shareId = randomUUID();
  const shareToken = createHash('sha256')
    .update(`${shareId}:${payload.manifest.hash}:${options.recipientOrgId ?? 'public'}`)
    .digest('hex');

  const shareEntry: EvidencePackShare = {
    shareId,
    shareToken,
    recipientOrgId: options.recipientOrgId ?? null,
    channel: options.channel ?? 'api',
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const updatedPayload: EvidencePackPayload = {
    ...payload,
    shareHistory: [...(payload.shareHistory ?? []), shareEntry],
  };

  await client.evidencePack.update({
    where: { id: record.id },
    data: {
      items: sanitizeJson(updatedPayload) as Prisma.InputJsonValue,
    },
  });

  return { share: shareEntry, payload: updatedPayload, record };
}

async function buildNcqaEvidencePack(
  clinicianId: string,
  client: PrismaClient
): Promise<EvidencePackBuildResult> {
  const clinician = await loadClinicianSummary(client, clinicianId);
  const [evidenceRecords, complianceChecks] = await Promise.all([
    client.auditEvidence.findMany({
      where: { clinicianId },
      orderBy: { createdAt: 'asc' },
    }),
    client.complianceCheck.findMany({
      where: { clinicianId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const anchors = listAnchorEvents({ clinicianId, limit: 50 });
  const anchorSummaries = summarizeAnchors(anchors);
  const warnings = await detectEvidenceDeltas(clinicianId, client);
  const generatedAt = new Date().toISOString();

  const items: EvidencePackItem[] = [
    ...buildNcqaEvidenceItems(evidenceRecords),
    ...buildNcqaComplianceItems(complianceChecks),
  ];

  const payload = finalizePayload({
    clinician,
    clinicianId,
    packType: 'ncqa-cr',
    generatedAt,
    items,
    warnings,
    anchors: anchorSummaries,
  });

  return persistEvidencePack(client, payload);
}

async function buildDeaEvidencePack(
  clinicianId: string,
  client: PrismaClient
): Promise<EvidencePackBuildResult> {
  const clinician = await loadClinicianSummary(client, clinicianId);
  const credential = await client.dEACredential.findFirst({
    where: { clinicianId },
    orderBy: { updatedAt: 'desc' },
  });

  if (!credential) {
    throw new Error(`DEA credential not found for clinician ${clinicianId}`);
  }

  const metadata = (credential.metadata as Record<string, unknown> | null) ?? {};
  const mateCategories = Array.isArray((metadata as any)?.mateCategories)
    ? ((metadata as any).mateCategories as string[])
    : [];
  const mateValidation = validateMateTraining({
    totalHours: credential.mateHours ?? 0,
    categories: mateCategories,
  });

  const anchors = listAnchorEvents({ clinicianId, limit: 25 }).filter((anchor) =>
    ['deaMateCredentialIssued', 'evidencePackAnchored'].includes(anchor.type)
  );
  const anchorSummaries = summarizeAnchors(anchors);
  const warnings = await detectEvidenceDeltas(clinicianId, client);
  const generatedAt = new Date().toISOString();

  const items: EvidencePackItem[] = [
    makeItem({
      key: 'dea-credential',
      label: 'DEA registry snapshot',
      type: 'dea.credential',
      capturedAt: credential.updatedAt?.toISOString() ?? credential.createdAt.toISOString(),
      source: 'deaRegistry',
      payload: {
        credentialId: credential.id,
        deaNumber: credential.deaNumber,
        expiration: credential.expiration.toISOString(),
        mateHours: credential.mateHours,
        metadata,
      },
    }),
    makeItem({
      key: 'mate-training',
      label: 'MATE training proof',
      type: 'dea.mate',
      capturedAt: credential.updatedAt?.toISOString() ?? credential.createdAt.toISOString(),
      source: 'mateValidator',
      payload: {
        totalHours: mateValidation.totalHours,
        categories: mateCategories,
        acceptedCategories: mateValidation.acceptedCategories,
        invalidCategories: mateValidation.invalidCategories,
        missingHours: mateValidation.missingHours,
        mateCompliant: mateValidation.mateCompliant,
      },
    }),
  ];

  if (anchorSummaries.length) {
    items.push(
      makeItem({
        key: 'dea-anchors',
        label: 'Chain anchors',
        type: 'dea.anchor',
        capturedAt: anchorSummaries[0]?.timestamp ?? null,
        source: 'audit.anchor',
        payload: {
          anchors: anchorSummaries,
        },
      })
    );
  }

  const payload = finalizePayload({
    clinician,
    clinicianId,
    packType: 'dea-mate',
    generatedAt,
    items,
    warnings,
    anchors: anchorSummaries,
  });

  return persistEvidencePack(client, payload);
}

async function buildJointCommissionPack(
  clinicianId: string,
  client: PrismaClient
): Promise<EvidencePackBuildResult> {
  const clinician = await loadClinicianSummary(client, clinicianId);
  const [licenses, caqhProfile, procedureVolumes, complianceChecks] = await Promise.all([
    client.stateLicenseVerification.findMany({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
    }),
    client.caqhProfile.findFirst({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
    }),
    client.procedureVolume.findMany({
      where: { clinicianId },
      orderBy: { periodEnd: 'desc' },
      take: 24,
    }),
    client.complianceCheck.findMany({
      where: {
        clinicianId,
        type: { in: ['sanctions', 'npdb'] },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const anchors = listAnchorEvents({ clinicianId, limit: 40 });
  const anchorSummaries = summarizeAnchors(anchors);
  const warnings = await detectEvidenceDeltas(clinicianId, client);
  const generatedAt = new Date().toISOString();

  const caqhFields = extractCaqhFields(caqhProfile);
  const sanctionCheck = complianceChecks.find((check) => check.type === 'sanctions');
  const npdbCheck = complianceChecks.find((check) => check.type === 'npdb');

  const items: EvidencePackItem[] = [
    makeItem({
      key: 'tjc-license',
      label: 'Licensure summary',
      type: 'tjc.license',
      capturedAt: licenses[0]?.updatedAt?.toISOString() ?? null,
      source: 'stateLicenseVerification',
      payload: summarizeLicensesForPack(licenses),
    }),
    makeItem({
      key: 'tjc-education',
      label: 'Education + training',
      type: 'tjc.education',
      capturedAt: caqhProfile?.updatedAt?.toISOString() ?? caqhProfile?.createdAt?.toISOString() ?? null,
      source: 'caqhProfile',
      payload: {
        caqhId: caqhProfile?.caqhId ?? null,
        attestationDate: caqhProfile?.attestationDate?.toISOString() ?? null,
        education: caqhFields?.education ?? [],
        boardCertifications: caqhFields?.boardCertifications ?? [],
        specialties: caqhFields?.specialties ?? [],
      },
    }),
    makeItem({
      key: 'tjc-experience',
      label: 'Experience evidence',
      type: 'tjc.experience',
      capturedAt: procedureVolumes[0]?.periodEnd?.toISOString() ?? null,
      source: 'procedureVolume',
      payload: summarizeProcedureVolume(procedureVolumes),
    }),
    makeItem({
      key: 'tjc-sanctions',
      label: 'Sanctions + NPDB monitoring',
      type: 'tjc.sanctions',
      capturedAt: sanctionCheck?.createdAt?.toISOString() ?? npdbCheck?.createdAt?.toISOString() ?? null,
      source: 'complianceChecks',
      payload: {
        sanctions: sanctionCheck
          ? {
              source: sanctionCheck.source,
              recordedAt: sanctionCheck.createdAt.toISOString(),
              result: jsonValue<Record<string, unknown>>(sanctionCheck.result),
            }
          : null,
        npdb: npdbCheck
          ? {
              source: npdbCheck.source,
              recordedAt: npdbCheck.createdAt.toISOString(),
              result: jsonValue<Record<string, unknown>>(npdbCheck.result),
            }
          : null,
      },
    }),
  ];

  const payload = finalizePayload({
    clinician,
    clinicianId,
    packType: 'tjc-psv',
    generatedAt,
    items,
    warnings,
    anchors: anchorSummaries,
  });

  return persistEvidencePack(client, payload);
}

async function loadClinicianSummary(client: PrismaClient, clinicianId: string): Promise<ClinicianSummary> {
  const clinician = await client.clinicianProfile.findUnique({
    where: { id: clinicianId },
    select: {
      id: true,
      orgId: true,
      npi: true,
      state: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!clinician) {
    throw new Error(`Clinician profile ${clinicianId} not found`);
  }

  return {
    id: clinician.id,
    orgId: clinician.orgId ?? null,
    name: clinician.user?.name ?? null,
    email: clinician.user?.email ?? null,
    npi: clinician.npi ?? null,
    state: clinician.state ?? null,
  };
}

function buildNcqaEvidenceItems(records: AuditEvidence[]): EvidencePackItem[] {
  return NCQA_CATEGORIES.map((category) => {
    const categoryRecords = records.filter((record) => record.category === category);
    const latest = categoryRecords.at(-1);
    return makeItem({
      key: `ncqa-${category.toLowerCase()}`,
      label: `NCQA ${category} evidence`,
      type: `ncqa.${category.toLowerCase()}`,
      capturedAt: latest?.createdAt?.toISOString() ?? null,
      source: 'auditEvidence',
      payload: {
        category,
        entryCount: categoryRecords.length,
        latestEntry: latest
          ? {
              evidenceId: latest.id,
              capturedAt: latest.createdAt.toISOString(),
              payload: jsonValue<Record<string, unknown>>(latest.payload),
            }
          : null,
        recentEntries: categoryRecords.slice(-5).map((entry) => ({
          evidenceId: entry.id,
          capturedAt: entry.createdAt.toISOString(),
          payload: jsonValue<Record<string, unknown>>(entry.payload),
        })),
      },
    });
  });
}

function buildNcqaComplianceItems(records: ComplianceCheck[]): EvidencePackItem[] {
  const grouped: Partial<Record<(typeof NCQA_COMPLIANCE_TYPES)[number], ComplianceCheck>> = {};

  for (const record of records) {
    const normalizedType = (record.type ?? '').toLowerCase() as (typeof NCQA_COMPLIANCE_TYPES)[number];
    if (!NCQA_COMPLIANCE_TYPES.includes(normalizedType)) {
      continue;
    }
    if (!grouped[normalizedType]) {
      grouped[normalizedType] = record;
    }
  }

  return NCQA_COMPLIANCE_TYPES.map((type) => {
    const record = grouped[type];
    return makeItem({
      key: `compliance-${type}`,
      label: `Compliance snapshot (${type})`,
      type: `ncqa.${type}`,
      capturedAt: record?.createdAt?.toISOString() ?? null,
      source: record?.source ?? 'compliance.cache',
      payload: record
        ? {
            complianceCheckId: record.id,
            recordedAt: record.createdAt.toISOString(),
            source: record.source,
            result: jsonValue<Record<string, unknown>>(record.result),
          }
        : {
            complianceCheckId: null,
            recordedAt: null,
            source: 'missing',
            result: null,
          },
    });
  });
}

function summarizeLicensesForPack(licenses: StateLicenseVerification[]) {
  const now = Date.now();
  return {
    total: licenses.length,
    active: licenses.filter((license) => (license.status ?? '').toUpperCase() === 'ACTIVE').length,
    expired: licenses.filter((license) => license.expiryDate && license.expiryDate.getTime() < now).map((license) => ({
      id: license.id,
      state: license.state,
      expiredAt: license.expiryDate?.toISOString() ?? null,
    })),
    expiringSoon: licenses
      .filter(
        (license) =>
          license.expiryDate && license.expiryDate.getTime() >= now && license.expiryDate.getTime() - now < 45 * 24 * 60 * 60 * 1000
      )
      .map((license) => ({
        id: license.id,
        state: license.state,
        expiresAt: license.expiryDate?.toISOString() ?? null,
      })),
    disciplinaryFlags: licenses
      .filter((license) => license.disciplinaryFlag)
      .map((license) => ({
        id: license.id,
        state: license.state,
        label: license.disciplinaryFlag,
      })),
  };
}

function summarizeProcedureVolume(volumes: ProcedureVolume[]) {
  const totalCases = volumes.reduce((sum, row) => sum + (row.count ?? 0), 0);
  const uniqueProcedures = new Set(volumes.map((row) => row.procedure)).size;
  const lastPeriodEnd = volumes[0]?.periodEnd?.toISOString() ?? null;
  return {
    periodsAnalyzed: volumes.length,
    totalCases,
    uniqueProcedures,
    windowMonths: 18,
    lastPeriodEnd,
    sample: volumes.slice(0, 6).map((row) => ({
      procedure: row.procedure,
      count: row.count,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
    })),
  };
}

function extractCaqhFields(record?: CaqhProfile | null): CaqhProfileFields | null {
  if (!record?.fields) {
    return null;
  }
  try {
    return parseCaqhProfileFields(record.fields as Record<string, unknown>);
  } catch (error) {
    console.warn('[evidencePack] Failed to parse CAQH profile fields', { error });
    return null;
  }
}

async function persistEvidencePack(
  client: PrismaClient,
  payload: EvidencePackPayload
): Promise<EvidencePackBuildResult> {
  const serialized = sanitizeJson(payload) as EvidencePackPayload;
  const record = await client.evidencePack.create({
    data: {
      id: serialized.packId,
      clinicianId: serialized.clinicianId,
      items: serialized as Prisma.InputJsonValue,
    },
  });

  anchorEvidencePack({
    clinicianId: serialized.clinicianId,
    packId: serialized.packId,
    packType: serialized.packType,
    packHash: serialized.manifest.hash,
    warnings: serialized.warnings.map((warning) => warning.message),
    generatedAt: serialized.generatedAt,
  });

  return {
    packId: serialized.packId,
    packType: serialized.packType,
    manifest: serialized.manifest,
    manifestYaml: serialized.manifestYaml,
    warnings: serialized.warnings,
    anchors: serialized.anchors,
    record,
    payload: serialized,
  };
}

function finalizePayload(input: {
  clinician: ClinicianSummary;
  clinicianId: string;
  packType: EvidencePackType;
  generatedAt: string;
  items: EvidencePackItem[];
  warnings: EvidenceDelta[];
  anchors: AnchorSummary[];
}): EvidencePackPayload {
  const packId = `${input.packType}-${randomUUID()}`;
  const manifestBase = {
    formatVersion: PACK_VERSION,
    packId,
    packType: input.packType,
    generatedAt: input.generatedAt,
    clinician: input.clinician,
    summary: {
      itemCount: input.items.length,
      warningCount: input.warnings.length,
      deltaCodes: input.warnings.map((warning) => warning.code),
      latestAnchor: input.anchors[0]?.timestamp ?? null,
    },
    items: input.items.map((item) => ({
      key: item.key,
      label: item.label,
      type: item.type,
      capturedAt: item.capturedAt,
      source: item.source,
      hash: item.hash,
    })),
    warnings: input.warnings,
    anchors: input.anchors,
  };

  const manifest: EvidenceManifest = {
    ...manifestBase,
    hash: hashPayload(manifestBase),
  };

  const manifestYaml = toYaml(manifest);

  return {
    packId,
    packType: input.packType,
    clinicianId: input.clinicianId,
    clinician: input.clinician,
    formatVersion: PACK_VERSION,
    generatedAt: input.generatedAt,
    items: input.items,
    warnings: input.warnings,
    anchors: input.anchors,
    manifest,
    manifestYaml,
    shareHistory: [],
  };
}

function makeItem(params: Omit<EvidencePackItem, 'hash' | 'payload'> & { payload: Record<string, unknown> }): EvidencePackItem {
  const payload = sanitizeJson(params.payload) as Record<string, unknown>;
  return {
    key: params.key,
    label: params.label,
    type: params.type,
    capturedAt: params.capturedAt,
    source: params.source,
    payload,
    hash: hashPayload({ type: params.type, payload }),
  };
}

async function detectEvidenceDeltas(clinicianId: string, client: PrismaClient): Promise<EvidenceDelta[]> {
  const [cmeEvidence, licenses, sanctionsCheck] = await Promise.all([
    client.auditEvidence.findFirst({
      where: { clinicianId, category: 'CR5' },
      orderBy: { createdAt: 'desc' },
    }),
    client.stateLicenseVerification.findMany({
      where: { clinicianId },
    }),
    client.complianceCheck.findFirst({
      where: { clinicianId, type: 'sanctions' },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const warnings: EvidenceDelta[] = [];
  const now = new Date();

  if (!cmeEvidence) {
    warnings.push({
      code: 'missing_cme',
      severity: 'critical',
      message: 'CME attestation evidence (CR5) has not been uploaded.',
      detectedAt: now.toISOString(),
    });
  } else if (differenceInCalendarDays(now, cmeEvidence.createdAt) > 365) {
    warnings.push({
      code: 'stale_cme',
      severity: 'warning',
      message: 'CME attestation evidence is older than 12 months.',
      detectedAt: now.toISOString(),
      details: { lastCapturedAt: cmeEvidence.createdAt.toISOString() },
    });
  }

  const expiredLicenses = licenses.filter(
    (license) => license.expiryDate && license.expiryDate.getTime() < now.getTime()
  );
  if (expiredLicenses.length) {
    warnings.push({
      code: 'expired_licensure',
      severity: 'critical',
      message: `Detected ${expiredLicenses.length} expired licensure records.`,
      detectedAt: now.toISOString(),
      details: {
        states: expiredLicenses.map((license) => license.state),
      },
    });
  }

  if (!sanctionsCheck || differenceInCalendarDays(now, sanctionsCheck.createdAt) > 30) {
    warnings.push({
      code: 'stale_sanctions',
      severity: 'warning',
      message: 'Sanctions check has not been refreshed within the last 30 days.',
      detectedAt: now.toISOString(),
      details: {
        lastCheckedAt: sanctionsCheck?.createdAt?.toISOString() ?? null,
      },
    });
  }

  return warnings;
}

function summarizeAnchors(records: AnchorRecord[]): AnchorSummary[] {
  return records.map((record) => ({
    type: record.type,
    txHash: record.txHash,
    network: record.network,
    timestamp: record.payload.timestamp,
    merkleRoot: record.merkleRoot,
  }));
}

function hashPayload(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function toYaml(value: unknown, indent = 0): string {
  const padding = '  '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `${padding}[]`;
    }
    return value
      .map((entry) => {
        if (isScalar(entry)) {
          return `${padding}- ${formatScalar(entry)}`;
        }
        return `${padding}-\n${toYaml(entry, indent + 1)}`;
      })
      .join('\n');
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return `${padding}{}`;
    }
    return entries
      .map(([key, val]) => {
        if (isScalar(val)) {
          return `${padding}${key}: ${formatScalar(val)}`;
        }
        return `${padding}${key}:\n${toYaml(val, indent + 1)}`;
      })
      .join('\n');
  }
  return `${padding}${formatScalar(value)}`;
}

function isScalar(value: unknown): boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined
  );
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string') {
    if (/[:\-\n]/.test(value)) {
      return JSON.stringify(value);
    }
    return value;
  }
  return JSON.stringify(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function jsonValue<T = Record<string, unknown>>(value: Prisma.JsonValue | null | undefined): T | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value as T;
}

function parseEvidencePackPayload(record: EvidencePackModel): EvidencePackPayload {
  const payload = record.items as Record<string, unknown> | null;
  if (!payload) {
    throw new Error('Evidence pack payload is empty');
  }
  return payload as EvidencePackPayload;
}

