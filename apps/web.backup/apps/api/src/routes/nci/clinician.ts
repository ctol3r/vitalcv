import { Router, type Request, type Response } from 'express';
import {
  PrismaClient,
  type Prisma,
  type StateLicenseVerification,
  type EhrSynchronization,
} from '@prisma/client';
import {
  runFederatedLookup,
} from '../../../../services/nci/federatedLookup';
import {
  buildLicenseProof,
} from '../../../../services/nci/proofBuilders/licenseProofBuilder';
import {
  buildPrivilegeProof,
} from '../../../../services/nci/proofBuilders/privilegeProofBuilder';
import {
  buildEnrollmentProof,
} from '../../../../services/nci/proofBuilders/enrollmentProofBuilder';
import type {
  FederatedLookupResult,
  FederatedNodeConfig,
  LicenseRecordSummary,
  PrivilegeVerificationRecord,
  EnrollmentRecordSummary,
  TrustAnchorEntry,
} from '../../../../services/nci/types';
import {
  getCredentialRiskSummary,
  getPecosSummaryForClinician,
  getCompactEvidenceSummaries,
  type PecosEvidenceSummary,
} from '../../../../services/psv/evidenceBundle';
import { evaluatePrivilegeEligibility } from '../../../../services/privyDep/eligibilityEngine';

const prisma = new PrismaClient();
const router = Router();

const FEDERATED_NODES = loadFederatedNodesFromEnv();

type PrivilegeGrantWithSet = Prisma.PrivilegeGrantedGetPayload<{
  include: {
    privilegeRequest: {
      include: {
        privilegeSet: true;
      };
    };
  };
}>;

type EnrollmentWithPayer = Prisma.PayerEnrollmentV2GetPayload<{
  include: { payer: true };
}>;

router.get('/clinician/:npi', async (req: Request, res: Response) => {
  const { npi } = req.params;
  if (!npi || typeof npi !== 'string' || npi.trim().length === 0) {
    return res.status(400).json({
      error: 'invalid_npi',
      message: 'NPI path parameter is required',
    });
  }

  try {
    const clinician = await prisma.clinicianProfile.findFirst({
      where: { npi },
      include: {
        user: true,
        caqhProfiles: true,
      },
    });

    if (!clinician) {
      return res.status(404).json({
        error: 'clinician_not_found',
        message: `Clinician with NPI ${npi} not found`,
      });
    }

    const privilegeWhere: Prisma.PrivilegeGrantedWhereInput =
      clinician.user?.did
        ? { clinicianDid: clinician.user.did }
        : { clinicianId: clinician.id };

    const federatedPromise: Promise<FederatedLookupResult> =
      FEDERATED_NODES.length > 0
        ? runFederatedLookup({
            npi,
            requestId: req.headers['x-request-id'] as string | undefined,
            nodes: FEDERATED_NODES,
          })
        : Promise.resolve(createEmptyFederatedResult());

    const [
      licenses,
      privilegeGrants,
      payerEnrollments,
      riskSummary,
      compactSummaries,
      federatedResult,
      pecosSummary,
      ehrSyncRecords,
    ] = await Promise.all([
      prisma.stateLicenseVerification.findMany({
        where: { clinicianId: clinician.id },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.privilegeGranted.findMany({
        where: privilegeWhere,
        include: {
          privilegeRequest: {
            include: {
              privilegeSet: true,
            },
          },
        },
        orderBy: { grantedAt: 'desc' },
      }),
      prisma.payerEnrollmentV2.findMany({
        where: { clinicianId: clinician.id },
        include: { payer: true },
        orderBy: { updatedAt: 'desc' },
      }),
      getCredentialRiskSummary(clinician.id),
      getCompactEvidenceSummaries(clinician.user?.did ?? ''),
      federatedPromise,
      getPecosSummaryForClinician(clinician.id),
      prisma.ehrSynchronization.findMany({
        where: { clinicianId: clinician.id },
      }),
    ]);

    const licenseRecords = mapLicenseRecords(licenses);
    const ehrEvidence = buildEhrEvidenceMap(ehrSyncRecords);
    const privilegeRecords = await buildPrivilegeRecords({
      clinicianId: clinician.id,
      grants: privilegeGrants,
      ehrEvidence,
    });
    const enrollmentRecords = mapEnrollmentRecords(payerEnrollments);

    const licenseSummary = summarizeLicenses(licenseRecords);
    const privilegeSummary = summarizePrivileges(privilegeRecords);
    const enrollmentSummary = summarizeEnrollments(enrollmentRecords, pecosSummary);

    const trustAnchors = buildTrustAnchors({
      licenses: licenseRecords,
      privileges: privilegeRecords,
      enrollments: enrollmentRecords,
      pecos: pecosSummary,
      compacts: compactSummaries,
      riskSummary,
      federated: federatedResult,
    });

    const proofs = await buildProofs({
      did: clinician.user?.did ?? null,
      licenses: licenseRecords,
      privileges: privilegeRecords,
      enrollments: enrollmentRecords,
      pecos: pecosSummary,
    });

    return res.json({
      success: true,
      clinician: {
        id: clinician.id,
        did: clinician.user?.did ?? null,
        npi: clinician.npi,
        fullName: clinician.user?.name ?? null,
        specialty: clinician.specialty,
        state: clinician.state,
        orgId: clinician.orgId,
        caqhId: clinician.caqhProfiles?.[0]?.caqhId ?? null,
      },
      licenseSummary,
      privilegeSummary,
      enrollmentSummary,
      risk: riskSummary,
      compactEligibility: compactSummaries,
      trustAnchors,
      proofs,
      federated: federatedResult,
    });
  } catch (error) {
    console.error('Failed to build NCI clinician profile', error);
    return res.status(500).json({
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

function mapLicenseRecords(licenses: StateLicenseVerification[]): LicenseRecordSummary[] {
  return licenses.map((license) => ({
    state: license.state,
    licenseNumber: license.licenseNumber,
    status: license.status,
    issueDate: license.issueDate ? license.issueDate.toISOString() : null,
    expiryDate: license.expiryDate ? license.expiryDate.toISOString() : null,
    disciplinaryFlag: license.disciplinaryFlag,
    source: license.source ?? 'state_board',
    verifiedAt: license.verifiedAt ? license.verifiedAt.toISOString() : null,
    updatedAt: license.updatedAt ? license.updatedAt.toISOString() : null,
    metadata: (license.metadata as Record<string, unknown> | null) ?? null,
  }));
}

async function buildPrivilegeRecords(options: {
  clinicianId: string;
  grants: PrivilegeGrantWithSet[];
  ehrEvidence: Map<string, EhrSynchronization>;
}): Promise<PrivilegeVerificationRecord[]> {
  const dependencyMap = await evaluateDependencies(options.clinicianId, options.grants);
  return options.grants.map((grant) => {
    const privilegeCodes =
      grant.privilegeRequest?.privilegeSet?.privilegeCodes ?? [];
    const dependency = dependencyMap.get(grant.id) ?? {
      dependencySatisfied: true,
      missingDependencies: [],
    };
    const ehrRecord = grant.privilegeSetId
      ? options.ehrEvidence.get(grant.privilegeSetId)
      : undefined;

    return {
      id: grant.id,
      privilegeSetId: grant.privilegeSetId,
      privilegeCodes,
      status: grant.status,
      grantedAt: grant.grantedAt ? grant.grantedAt.toISOString() : null,
      expiresAt: grant.expiresAt ? grant.expiresAt.toISOString() : null,
      renewalDue: grant.renewalDue ? grant.renewalDue.toISOString() : null,
      dependencySatisfied: dependency.dependencySatisfied,
      missingDependencies: dependency.missingDependencies,
      ehrSync: ehrRecord
        ? {
            status: ehrRecord.status,
            lastAttemptAt: ehrRecord.lastAttemptAt
              ? ehrRecord.lastAttemptAt.toISOString()
              : null,
            metadata: (ehrRecord.metadata as Record<string, unknown> | null) ?? null,
          }
        : null,
      reviewerDid: grant.reviewerDid,
      orgId: grant.orgId,
    };
  });
}

function mapEnrollmentRecords(enrollments: EnrollmentWithPayer[]): EnrollmentRecordSummary[] {
  return enrollments.map((enrollment) => ({
    id: enrollment.id,
    payerId: enrollment.payerId,
    payerName: enrollment.payer?.name ?? enrollment.payerId,
    status: enrollment.status,
    panelType: enrollment.panelType,
    states: enrollment.payer?.states ?? [],
    specialties: enrollment.payer?.specialty ?? [],
    effectiveDate: enrollment.effectiveDate ? enrollment.effectiveDate.toISOString() : null,
    updatedAt: enrollment.updatedAt ? enrollment.updatedAt.toISOString() : null,
    lastStatusChange: enrollment.lastStatusChange
      ? enrollment.lastStatusChange.toISOString()
      : null,
    metadata: (enrollment.metadata as Record<string, unknown> | null) ?? null,
    planTypes: enrollment.payer?.planTypes ?? [],
  }));
}

function summarizeLicenses(records: LicenseRecordSummary[]) {
  const active = records.filter((record) => normalizeStatus(record.status) === 'ACTIVE');
  const expired = records.filter((record) => normalizeStatus(record.status) === 'EXPIRED');
  return {
    total: records.length,
    active: active.length,
    expired: expired.length,
    states: Array.from(new Set(records.map((record) => record.state))).sort(),
    records,
  };
}

function summarizePrivileges(records: PrivilegeVerificationRecord[]) {
  const active = records.filter((record) => record.status === 'ACTIVE');
  const hold = records.filter((record) => record.status === 'HOLD');
  return {
    total: records.length,
    active: active.length,
    hold: hold.length,
    grants: records,
  };
}

function summarizeEnrollments(
  records: EnrollmentRecordSummary[],
  pecosSummary?: PecosEvidenceSummary | null
) {
  const active = records.filter((record) => normalizeStatus(record.status) === 'ACTIVE');
  const pending = records.filter((record) => normalizeStatus(record.status) === 'PENDING');
  const medicaidStates = records
    .filter((record) => record.planTypes?.some((plan) => plan.toLowerCase().includes('medicaid')))
    .flatMap((record) => record.states)
    .filter((state, index, arr) => arr.indexOf(state) === index);

  return {
    total: records.length,
    active: active.length,
    pending: pending.length,
    medicaidStates,
    pecos: pecosSummary,
    records,
  };
}

function buildTrustAnchors(options: {
  licenses: LicenseRecordSummary[];
  privileges: PrivilegeVerificationRecord[];
  enrollments: EnrollmentRecordSummary[];
  pecos?: PecosEvidenceSummary | null;
  compacts: Awaited<ReturnType<typeof getCompactEvidenceSummaries>>;
  riskSummary: Awaited<ReturnType<typeof getCredentialRiskSummary>>;
  federated: FederatedLookupResult;
}): TrustAnchorEntry[] {
  const anchors: TrustAnchorEntry[] = [];
  const seen = new Set<string>();

  const push = (anchor: TrustAnchorEntry) => {
    const key = `${anchor.type}:${anchor.referenceId ?? anchor.source}:${anchor.jurisdiction ?? ''}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    anchors.push(anchor);
  };

  options.licenses.forEach((license) => {
    push({
      type: 'STATE_BOARD',
      source: license.source ?? 'state_board',
      referenceId: license.licenseNumber,
      jurisdiction: license.state,
      lastVerifiedAt: license.verifiedAt ?? license.updatedAt ?? null,
    });
  });

  if (options.pecos?.provider) {
    push({
      type: 'PECOS',
      source: 'PECOS',
      referenceId: options.pecos.provider.providerId,
      lastVerifiedAt: options.pecos.provider.lastCheckedAt,
    });
  }

  options.enrollments.forEach((enrollment) => {
    push({
      type: 'PAYER_NETWORK',
      source: enrollment.payerName,
      referenceId: enrollment.id,
      jurisdiction: enrollment.states[0],
      lastVerifiedAt: enrollment.updatedAt ?? enrollment.effectiveDate ?? null,
    });
  });

  options.privileges.forEach((privilege) => {
    push({
      type: 'PRIVILEGE',
      source: privilege.orgId ?? 'org',
      referenceId: privilege.id,
      lastVerifiedAt: privilege.grantedAt ?? undefined,
      metadata: {
        dependencySatisfied: privilege.dependencySatisfied,
      },
    });
  });

  options.compacts.forEach((compact) => {
    push({
      type: 'COMPACT',
      source: compact.compactType,
      referenceId: compact.compactType,
      lastVerifiedAt: compact.ruleSummary.conditions[0]?.detail ?? undefined,
    });
  });

  if (options.riskSummary) {
    push({
      type: 'RISK_ENGINE',
      source: 'credential_risk',
      referenceId: options.riskSummary.clinicianId,
      lastVerifiedAt: options.riskSummary.updatedAt,
      metadata: {
        score: options.riskSummary.score,
      },
    });
  }

  options.federated.aggregated.trustAnchors.forEach((anchor) => push(anchor));
  options.federated.nodes
    .filter((node) => node.status === 'ok')
    .forEach((node) => {
      push({
        type: 'FEDERATED_NODE',
        source: node.id,
        referenceId: node.id,
        lastVerifiedAt: new Date().toISOString(),
      });
    });

  return anchors;
}

async function buildProofs(options: {
  did?: string | null;
  licenses: LicenseRecordSummary[];
  privileges: PrivilegeVerificationRecord[];
  enrollments: EnrollmentRecordSummary[];
  pecos?: PecosEvidenceSummary | null;
}) {
  const [licenseProof, privilegeProof, enrollmentProof] = await Promise.all([
    buildLicenseProof({ clinicianDid: options.did, licenses: options.licenses }),
    buildPrivilegeProof({ clinicianDid: options.did, grants: options.privileges }),
    buildEnrollmentProof({
      clinicianDid: options.did,
      enrollments: options.enrollments,
      pecosSummary: options.pecos,
    }),
  ]);

  return {
    license: licenseProof,
    privilege: privilegeProof,
    enrollment: enrollmentProof,
  };
}

async function evaluateDependencies(clinicianId: string, grants: PrivilegeGrantWithSet[]) {
  const results = await Promise.all(
    grants.map(async (grant) => {
      const privilegeCodes =
        grant.privilegeRequest?.privilegeSet?.privilegeCodes ?? [];
      if (!privilegeCodes.length) {
        return {
          id: grant.id,
          dependencySatisfied: true,
          missingDependencies: [],
        };
      }

      const evaluations = await Promise.all(
        privilegeCodes.map(async (code) => {
          try {
            const evaluation = await evaluatePrivilegeEligibility({
              clinicianId,
              privilegeCode: code,
            });
            return {
              eligible: evaluation.eligible,
              missing: evaluation.missingPrereqs,
            };
          } catch (error) {
            console.warn('Failed to evaluate privilege dependency', {
              clinicianId,
              privilegeCode: code,
              error,
            });
            return {
              eligible: false,
              missing: ['eligibility_evaluation_error'],
            };
          }
        })
      );

      const dependencySatisfied = evaluations.every((entry) => entry.eligible);
      const missingDependencies = evaluations.flatMap((entry) => entry.missing);

      return {
        id: grant.id,
        dependencySatisfied,
        missingDependencies,
      };
    })
  );

  return new Map(results.map((entry) => [entry.id, entry]));
}

function buildEhrEvidenceMap(records: EhrSynchronization[]) {
  const map = new Map<string, Prisma.EhrSynchronization>();
  records.forEach((record) => {
    if (record.privilegeSetId) {
      map.set(record.privilegeSetId, record);
    }
  });
  return map;
}

function normalizeStatus(status?: string | null) {
  return status?.toUpperCase() ?? 'UNKNOWN';
}

function loadFederatedNodesFromEnv(): FederatedNodeConfig[] {
  const raw = process.env.NCI_FEDERATED_NODES;
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry, index) => normalizeNodeConfig(entry, index))
      .filter((entry): entry is FederatedNodeConfig => entry !== null);
  } catch (error) {
    console.warn('Failed to parse NCI_FEDERATED_NODES env', error);
    return [];
  }
}

function normalizeNodeConfig(value: any, index: number): FederatedNodeConfig | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  if (typeof value.endpoint !== 'string' || !value.endpoint) {
    return null;
  }
  const config: FederatedNodeConfig = {
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id : `nci-node-${index + 1}`,
    endpoint: value.endpoint,
    method: value.method === 'GET' ? 'GET' : 'POST',
    timeoutMs: typeof value.timeoutMs === 'number' ? value.timeoutMs : undefined,
    enabled: value.enabled !== false,
  };

  if (value.auth && typeof value.auth === 'object') {
    if (value.auth.type === 'dpop' && value.auth.jwk) {
      try {
        const jwk =
          typeof value.auth.jwk === 'string'
            ? JSON.parse(resolveEnvReference(value.auth.jwk) ?? '{}')
            : value.auth.jwk;
        config.auth = {
          type: 'dpop',
          jwk,
          accessToken: resolveEnvReference(value.auth.accessToken),
        };
      } catch (error) {
        console.warn('Failed to parse DPoP JWK for federated node', config.id, error);
      }
    } else if (value.auth.type === 'mtls') {
      const cert = resolveEnvReference(value.auth.cert);
      const key = resolveEnvReference(value.auth.key);
      if (cert && key) {
        config.auth = {
          type: 'mtls',
          cert,
          key,
          ca: resolveEnvReference(value.auth.ca),
          passphrase: resolveEnvReference(value.auth.passphrase),
          rejectUnauthorized: value.auth.rejectUnauthorized !== false,
        };
      }
    }
  }

  return config;
}

function resolveEnvReference(value?: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  if (value.startsWith('env:')) {
    const variable = value.slice(4);
    return process.env[variable];
  }
  return value;
}

function createEmptyFederatedResult(): FederatedLookupResult {
  return {
    nodes: [],
    aggregated: {
      licenseRecords: [],
      privilegeRecords: [],
      enrollmentRecords: [],
      trustAnchors: [],
    },
  };
}

