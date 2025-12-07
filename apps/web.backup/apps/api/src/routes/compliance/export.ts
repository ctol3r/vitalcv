import { Router, type Request, type Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { listAnchorEvents } from '../../services/audit/anchor';
import type { AnchorRecord } from '../../services/audit/anchor';
import type { ProofMetrics } from '../../services/zk/prover';

const prisma = new PrismaClient();
const router = Router();

type AuditEvidenceRecord = Prisma.AuditEvidenceGetPayload<{
  select: { id: true; category: true; payload: true; createdAt: true };
}>;

type ComplianceCheckRecord = Prisma.ComplianceCheckGetPayload<{
  select: { id: true; type: true; source: true; result: true; createdAt: true };
}>;

type AuditProofRecord = Prisma.AuditProofGetPayload<{
  select: { id: true; eventId: true; circuitType: true; proof: true; createdAt: true; updatedAt: true };
}>;

const CR_CATEGORIES = ['CR1', 'CR2', 'CR3', 'CR4', 'CR5'] as const;
const COMPLIANCE_TYPES = ['license', 'sanctions', 'npdb', 'expiry'] as const;

router.get('/export/:clinicianId', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;
  if (!clinicianId) {
    return res.status(400).json({
      error: 'clinician_id_required',
      message: 'Clinician identifier is required',
    });
  }

  try {
    const clinician = await prisma.clinicianProfile.findUnique({
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
      return res.status(404).json({
        error: 'clinician_not_found',
        message: `Clinician ${clinicianId} not found`,
      });
    }

    const [evidence, complianceChecks, zkProofs, zkAnchors] = await Promise.all([
      prisma.auditEvidence.findMany({
        where: { clinicianId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, category: true, payload: true, createdAt: true },
      }),
      prisma.complianceCheck.findMany({
        where: { clinicianId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, type: true, source: true, result: true, createdAt: true },
      }),
      prisma.auditProof.findMany({
        orderBy: { createdAt: 'desc' },
        take: Number(req.query.zkLimit ?? process.env.ZK_PROOF_EXPORT_LIMIT ?? 50),
        select: { id: true, eventId: true, circuitType: true, proof: true, createdAt: true, updatedAt: true },
      }),
      Promise.resolve(listAnchorEvents({ type: 'zkAuditProofAnchored', limit: 200 })),
    ]);

    const bundle = buildEvidenceBundle(evidence);
    const latestChecks = selectLatestChecks(complianceChecks);
    const anchors = listAnchorEvents({ clinicianId, limit: 25 });

    const payload = {
      clinician: {
        id: clinician.id,
        orgId: clinician.orgId,
        npi: clinician.npi,
        state: clinician.state,
        name: clinician.user?.name ?? null,
        contactEmail: clinician.user?.email ?? null,
      },
      bundle,
      complianceChecks: latestChecks,
      sourceMetadata: buildSourceMetadata(bundle, latestChecks),
      auditAnchors: anchors,
      timestamps: buildTimestamps(evidence, complianceChecks),
      zkProofBundle: buildZkProofBundle(zkProofs, zkAnchors),
    };

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ncqa-${clinicianId}.json"`,
    );
    return res.json(payload);
  } catch (error) {
    console.error('[compliance:export] failed', error);
    return res.status(500).json({
      error: 'compliance_export_failed',
      message: error instanceof Error ? error.message : 'Unknown failure',
    });
  }
});

function buildEvidenceBundle(records: AuditEvidenceRecord[]) {
  return CR_CATEGORIES.map((category) => {
    const entries = records
      .filter((record) => record.category === category)
      .map((record) => ({
        evidenceId: record.id,
        capturedAt: record.createdAt.toISOString(),
        payload: record.payload as Prisma.InputJsonValue,
      }));

    return {
      category,
      count: entries.length,
      latestEntry: entries.length ? entries[entries.length - 1] : null,
      entries,
    };
  });
}

function selectLatestChecks(records: ComplianceCheckRecord[]) {
  const grouped: Record<(typeof COMPLIANCE_TYPES)[number], ReturnType<typeof serializeComplianceCheck> | null> = {
    license: null,
    sanctions: null,
    npdb: null,
    expiry: null,
  };

  for (const record of records) {
    const type = record.type as (typeof COMPLIANCE_TYPES)[number];
    if (!COMPLIANCE_TYPES.includes(type)) {
      continue;
    }
    if (!grouped[type]) {
      grouped[type] = serializeComplianceCheck(record);
    }
  }

  return grouped;
}

function serializeComplianceCheck(record?: ComplianceCheckRecord | null) {
  if (!record) {
    return null;
  }
  return {
    id: record.id,
    type: record.type,
    source: record.source,
    recordedAt: record.createdAt.toISOString(),
    result: (record.result as Record<string, unknown>) ?? {},
  };
}

function buildSourceMetadata(
  bundle: ReturnType<typeof buildEvidenceBundle>,
  checks: ReturnType<typeof selectLatestChecks>,
) {
  const evidenceMeta = bundle.reduce<Record<string, { evidenceId: string; capturedAt: string } | null>>(
    (acc, section) => {
      acc[section.category] = section.latestEntry
        ? {
            evidenceId: section.latestEntry.evidenceId,
            capturedAt: section.latestEntry.capturedAt,
          }
        : null;
      return acc;
    },
    {},
  );

  const complianceMeta = Object.fromEntries(
    COMPLIANCE_TYPES.map((type) => [
      type,
      checks[type]
        ? {
            checkId: checks[type]?.id ?? null,
            recordedAt: checks[type]?.recordedAt ?? null,
            source: checks[type]?.source ?? null,
          }
        : null,
    ]),
  );

  return {
    evidence: evidenceMeta,
    compliance: complianceMeta,
  };
}

function buildZkProofBundle(records: AuditProofRecord[], anchors: AnchorRecord[]) {
  return {
    generatedAt: new Date().toISOString(),
    totalProofs: records.length,
    proofs: records.map(serializeAuditProofRecord),
    anchors,
  };
}

type StoredProofPayload = {
  mode: 'snark' | 'mock';
  publicSignals?: string[];
  circuitInput?: {
    leaf: string;
    root: string;
    siblings: string[];
    pathPositions: string[];
  };
  ledgerRoot?: string;
  pathCommitment?: string;
  metrics: ProofMetrics;
  block?: {
    blockHash: string;
    merklePath?: string[];
    palletName?: string | null;
    eventType?: string | null;
    timestamp?: string;
  };
};

function serializeAuditProofRecord(record: AuditProofRecord) {
  const proof = coerceStoredProof(record.proof);
  return {
    eventId: record.eventId,
    circuitType: record.circuitType,
    mode: proof.mode,
    issuedAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    ledgerRoot: proof.ledgerRoot ?? proof.circuitInput?.root ?? null,
    pathCommitment: proof.pathCommitment ?? null,
    metrics: proof.metrics,
    block: proof.block ?? null,
    publicSignals: proof.publicSignals ?? [],
  };
}

function coerceStoredProof(payload: AuditProofRecord['proof']): StoredProofPayload {
  if (payload && typeof payload === 'object') {
    return payload as StoredProofPayload;
  }
  return {
    mode: 'mock',
    metrics: {
      mode: 'mock',
      provingTimeMs: 0,
      circuitSize: 0,
      constraintCount: 0,
      depth: 0,
    },
  };
}

function buildTimestamps(
  evidence: AuditEvidenceRecord[],
  checks: ComplianceCheckRecord[],
) {
  const bundleStartedAt = evidence[0]?.createdAt?.toISOString() ?? null;
  const bundleFinalizedAt =
    evidence[evidence.length - 1]?.createdAt?.toISOString() ?? null;
  const lastComplianceCheck = checks[0]?.createdAt?.toISOString() ?? null;

  return {
    bundleStartedAt,
    bundleFinalizedAt,
    lastComplianceCheck,
    generatedAt: new Date().toISOString(),
  };
}

export default router;



