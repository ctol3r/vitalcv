/**
 * B169A-PECOS-006: PECOS summary helper for PSV evidence bundles
 *
 * Fetches PECOSProvider + PECOSDocument rows and serializes them for ZIP export.
 */

import { PrismaClient } from '@prisma/client';
import { CredentialRiskFactors } from '../credentialRisk/enums';
import type {
  CompactType,
  ClinicianCompactProfile,
  PracticeEligibilityResult,
} from '../compacts/eligibilityEngine.js';
import {
  evaluatePracticeEligibility,
  listAuthorizedStatesForCompact,
} from '../compacts/eligibilityEngine.js';
import type { CompactsStatusData } from '../compacts/models/CompactsStatus.js';
import { buildClinicianProfileFromStatus } from '../compacts/profileAdapter.js';

const prisma = new PrismaClient();

export interface PecosEvidenceSummary {
  clinicianId: string;
  provider?: {
    providerId: string;
    npi: string;
    medicareId: string | null;
    enrollmentType: string;
    status: string;
    effectiveDate: string | null;
    revalidationDate: string | null;
    lastCheckedAt: string | null;
  };
  documents: Array<{
    documentType: string;
    submittedAt: string | null;
    parsedFields: Record<string, unknown>;
  }>;
  enrollments: Array<{
    enrollmentType: string;
    currentStatus: string;
    revalidationDueAt: string | null;
    lastCheckedAt: string | null;
    statuses: Array<{
      status: string;
      occurredAt: string | null;
      source?: string;
      note?: string;
    }>;
    anomalies: Array<Record<string, unknown>>;
  }>;
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export async function getPecosSummaryForClinician(
  clinicianId: string
): Promise<PecosEvidenceSummary | null> {
  if (!clinicianId) return null;

  const [provider, lifecycle] = await Promise.all([
    prisma.pECOSProvider.findFirst({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
      include: {
        documents: true,
      },
    }),
    prisma.pECOSEnrollment.findMany({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  if (!provider && lifecycle.length === 0) {
    return null;
  }

  return {
    clinicianId,
    provider: provider
      ? {
          providerId: provider.id,
          npi: provider.npi,
          medicareId: provider.medicareId ?? null,
          enrollmentType: provider.enrollmentType,
          status: provider.status,
          effectiveDate: toIso(provider.effectiveDate),
          revalidationDate: toIso(provider.revalidationDate),
          lastCheckedAt: toIso(provider.lastCheckedAt),
        }
      : undefined,
    documents: provider
      ? provider.documents.map((doc) => ({
          documentType: doc.documentType,
          submittedAt: toIso(doc.submittedAt),
          parsedFields: (doc.parsedFields as Record<string, unknown>) ?? {},
        }))
      : [],
    enrollments: lifecycle.map((record) => ({
      enrollmentType: record.enrollmentType,
      currentStatus: record.currentStatus,
      revalidationDueAt: toIso(record.revalidationDueAt),
      lastCheckedAt: toIso(record.lastCheckedAt),
      statuses: mapLifecycleStatuses(record.statuses),
      anomalies: Array.isArray(record.anomalies)
        ? (record.anomalies as Array<Record<string, unknown>>)
        : [],
    })),
  };
}

function mapLifecycleStatuses(raw: unknown): Array<{
  status: string;
  occurredAt: string | null;
  source?: string;
  note?: string;
}> {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return {
        status: 'UNKNOWN',
        occurredAt: null,
      };
    }
    const record = entry as Record<string, unknown>;
    return {
      status: String(record.status ?? 'UNKNOWN'),
      occurredAt: toIso(record.occurredAt as Date | string | null | undefined),
      source: typeof record.source === 'string' ? record.source : undefined,
      note: typeof record.note === 'string' ? record.note : undefined,
    };
  });
}

export interface RiskEvidenceSummary {
  clinicianId: string;
  score: number;
  factors: CredentialRiskFactors[];
  updatedAt: string;
}

export async function getCredentialRiskSummary(
  clinicianId: string
): Promise<RiskEvidenceSummary | null> {
  if (!clinicianId) return null;

  const record = await prisma.credentialRisk.findUnique({
    where: { clinicianId },
  });

  if (!record) {
    return null;
  }

  return {
    clinicianId,
    score: record.score,
    factors: (record.factors as CredentialRiskFactors[]) ?? [],
    updatedAt: record.updatedAt.toISOString(),
  };
}

export interface NcqaComplianceEvidence {
  clinicianId: string;
  generatedAt: string;
  summary: {
    totalRules: number;
    byStatus: Record<string, number>;
    failingRules: string[];
  };
  rules: Array<{
    ruleCode: string;
    status: string;
    lastVerifiedAt: string | null;
    nextDueAt: string | null;
    notes?: string | null;
    evidenceRefs: unknown[];
  }>;
}

export async function getNcqaComplianceSnapshot(
  clinicianId: string
): Promise<NcqaComplianceEvidence | null> {
  if (!clinicianId) return null;

  const records = await prisma.nCQAComplianceRecord.findMany({
    where: { clinicianId },
    orderBy: { ruleCode: 'asc' },
  });

  if (records.length === 0) {
    return null;
  }

  const byStatus: Record<string, number> = {};
  const failingRules: string[] = [];

  const serializedRules = records.map((record) => {
    byStatus[record.status] = (byStatus[record.status] ?? 0) + 1;
    if (record.status === 'FAIL' || record.status === 'WARN') {
      failingRules.push(record.ruleCode);
    }

    return {
      ruleCode: record.ruleCode,
      status: record.status,
      lastVerifiedAt: toIso(record.lastVerifiedAt),
      nextDueAt: toIso(record.nextDueAt),
      notes: record.notes ?? null,
      evidenceRefs: Array.isArray(record.evidenceRefs) ? (record.evidenceRefs as unknown[]) : [],
    };
  });

  return {
    clinicianId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalRules: records.length,
      byStatus,
      failingRules,
    },
    rules: serializedRules,
  };
}

export interface CompactEvidenceSummary {
  compactType: CompactType;
  authorizedStates: string[];
  representativeState: string;
  ruleSummary: PracticeEligibilityResult;
}

const SUPPORTED_COMPACTS: CompactType[] = ['IMLC', 'PSYPACT', 'NLC', 'APRN', 'PT'];

function compactSectionExists(profile: ClinicianCompactProfile, compactType: CompactType): boolean {
  const compacts = profile.compacts || {};
  switch (compactType) {
    case 'IMLC':
      return !!compacts.imlc;
    case 'PSYPACT':
      return !!compacts.psypact;
    case 'NLC':
      return !!compacts.nlc;
    case 'APRN':
      return !!compacts.aprn;
    case 'PT':
      return !!compacts.pt;
    default:
      return false;
  }
}

export async function getCompactEvidenceSummaries(
  clinicianDid: string
): Promise<CompactEvidenceSummary[]> {
  if (!clinicianDid) return [];

  const compactsStatus = await prisma.compactsStatus.findUnique({
    where: { clinicianDid },
  });

  if (!compactsStatus) {
    return [];
  }

  const profile = buildClinicianProfileFromStatus(compactsStatus as unknown as CompactsStatusData);
  const summaries: CompactEvidenceSummary[] = [];

  for (const compactType of SUPPORTED_COMPACTS) {
    if (!compactSectionExists(profile, compactType)) continue;

    const authorizedStates = listAuthorizedStatesForCompact(compactType, profile);
    if (authorizedStates.length === 0) continue;

    const representativeState =
      authorizedStates.find((state) => state !== profile.homeState) || authorizedStates[0];
    if (!representativeState) continue;

    const ruleSummary = evaluatePracticeEligibility(compactType, profile, representativeState);

    summaries.push({
      compactType,
      authorizedStates,
      representativeState,
      ruleSummary,
    });
  }

  return summaries;
}

