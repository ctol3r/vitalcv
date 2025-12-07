import { PrismaClient } from '@prisma/client';
import { CredentialRiskFactors } from '../credentialRisk/enums.js';
import { TrustedIssuerGraph } from '../trust/resolver/trustedIssuerGraph.js';
import type { TrustAnchor } from '../trust/resolver/trustedIssuerGraph.js';

const prisma = new PrismaClient();
const trustGraph = new TrustedIssuerGraph(prisma);

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

export interface CompactEvidenceSummary {
  compactType: 'IMLC' | 'PSYPACT' | 'COUNSELING';
  status: string;
  homeState?: string | null;
  authorizedStates: string[];
  updatedAt: string;
}

export interface RiskEvidenceSummary {
  clinicianId: string;
  score: number;
  factors: CredentialRiskFactors[];
  updatedAt: string;
}

function toIso(value?: Date | null): string | null {
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
export async function getCompactEvidenceSummaries(
  clinicianDid: string
): Promise<CompactEvidenceSummary[]> {
  if (!clinicianDid) return [];

  const status = await prisma.compactsStatus.findUnique({
    where: { clinicianDid },
  });

  if (!status) {
    return [];
  }

  const updatedAt = (status.updatedAt ?? status.lastComputedAt ?? new Date()).toISOString();
  const summaries: CompactEvidenceSummary[] = [];

  const addSummary = (
    compactType: CompactEvidenceSummary['compactType'],
    compactStatus?: string | null,
    states: string[] = [],
    homeState?: string | null
  ) => {
    if (!compactStatus || compactStatus.toUpperCase() === 'NOT_ELIGIBLE') {
      return;
    }
    summaries.push({
      compactType,
      status: compactStatus,
      homeState: homeState ?? null,
      authorizedStates: states,
      updatedAt,
    });
  };

  addSummary('IMLC', status.imlcStatus, status.imlcCompactStates ?? [], status.imlcHomeState);
  addSummary('PSYPACT', status.psypactStatus, status.psypactStates ?? [], status.imlcHomeState);
  addSummary(
    'COUNSELING',
    status.counselingStatus,
    status.counselingStates ?? [],
    status.counselingHomeState
  );

  return summaries;
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

export interface TrustEvidenceArtifact {
  credential: 'licenseCheck' | 'sanctionsCheck';
  issuerType: 'ISSUER' | 'VERIFIER';
  subjectId: string;
  context: Record<string, unknown>;
  anchors: Array<{
    entityId: string;
    did: string;
    displayName: string;
    trustScore: number;
    tier: string;
    accreditationStatus: string;
    jurisdiction: string | null;
    publicKeys: string[];
    scoreComponents: TrustAnchor['score']['components'];
    reasons: string[];
    source: TrustAnchor['source'];
    path: string[];
  }>;
}

export async function getTrustArtifactsForManifest(
  manifest: any,
  graph: TrustedIssuerGraph = trustGraph
): Promise<TrustEvidenceArtifact[]> {
  if (!manifest?.results) {
    return [];
  }

  const artifacts: TrustEvidenceArtifact[] = [];

  const licenseResult = manifest.results.licenseCheck;
  if (licenseResult?.state) {
    const licenseAnchors = await graph.resolve({
      kind: 'LICENSE',
      state: licenseResult.state,
    });
    if (licenseAnchors.length > 0) {
      artifacts.push({
        credential: 'licenseCheck',
        issuerType: 'ISSUER',
        subjectId: licenseResult.checkId,
        context: {
          state: licenseResult.state,
          licenseNumber: licenseResult.licenseNumber,
          sourceUrl: licenseResult.sourceUrl,
          verifiedAt: licenseResult.checkedAt,
        },
        anchors: licenseAnchors.map(serializeAnchor),
      });
    }
  }

  const sanctionsResult = manifest.results.sanctionsCheck;
  if (sanctionsResult) {
    const authority = deriveSanctionAuthority(sanctionsResult.sourceUrl);
    const sanctionAnchors = await graph.resolve({
      kind: 'SANCTIONS',
      authority,
    });
    if (sanctionAnchors.length > 0) {
      artifacts.push({
        credential: 'sanctionsCheck',
        issuerType: 'VERIFIER',
        subjectId: sanctionsResult.checkId,
        context: {
          authority,
          sourceUrl: sanctionsResult.sourceUrl,
          verifiedAt: sanctionsResult.checkedAt,
        },
        anchors: sanctionAnchors.map(serializeAnchor),
      });
    }
  }

  return artifacts;
}

function serializeAnchor(anchor: TrustAnchor) {
  return {
    entityId: anchor.entityId,
    did: anchor.did,
    displayName: anchor.displayName,
    trustScore: anchor.trustScore,
    tier: anchor.tier,
    accreditationStatus: anchor.accreditationStatus,
    jurisdiction: anchor.jurisdiction,
    publicKeys: anchor.publicKeys,
    scoreComponents: anchor.score.components,
    reasons: anchor.score.reasons,
    source: anchor.source,
    path: anchor.path,
  };
}

function deriveSanctionAuthority(sourceUrl?: string): string {
  if (!sourceUrl) {
    return 'OIG';
  }
  const normalized = sourceUrl.toLowerCase();
  if (normalized.includes('sam.gov')) {
    return 'GSA';
  }
  if (normalized.includes('oig.hhs')) {
    return 'OIG';
  }
  return 'OIG';
}
