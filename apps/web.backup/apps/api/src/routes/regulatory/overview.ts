/**
 * Regulatory Overview Endpoint
 * Task 4: Backend aggregator: /regulatory/overview
 *
 * Aggregates state boards, DEA, CMS/PECOS, and payer data
 */

import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.query;

    if (!clinicianId || typeof clinicianId !== 'string') {
      return res.status(400).json({ error: 'clinicianId required' });
    }

    // Task 5: Clinician identity binding (NPI + DID)
    const clinician = await prisma.clinician.findUnique({
      where: { id: clinicianId },
      select: {
        id: true,
        npi: true,
        did: true,
      },
    });

    if (!clinician) {
      return res.status(404).json({ error: 'Clinician not found' });
    }

    // Fetch state board licenses
    const licenses = await prisma.license.findMany({
      where: { clinicianId },
      include: {
        chainAnchor: true,
      },
    });

    // Fetch DEA status
    const deaRecord = await prisma.deaRegistration.findUnique({
      where: { clinicianId },
      include: {
        chainAnchor: true,
      },
    });

    // Fetch CMS/PECOS status
    const cmsRecord = await prisma.cmsPecosEnrollment.findUnique({
      where: { clinicianId },
      include: {
        chainAnchor: true,
      },
    });

    // Fetch payer enrollments
    const payerEnrollments = await prisma.payerEnrollment.findMany({
      where: { clinicianId },
      include: {
        chainAnchor: true,
      },
    });

    // Task 6: Calculate regulatory trustScore
    const trustScore = calculateRegulatoryTrustScore(
      licenses,
      deaRecord,
      cmsRecord,
      payerEnrollments,
    );

    // Task 7: Chain anchor summary for regulatory documents
    const chainAnchors = buildChainAnchorSummary(
      licenses,
      deaRecord,
      cmsRecord,
      payerEnrollments,
    );

    // Transform data to match frontend models
    const bundle = {
      clinicianId: clinician.id,
      npi: clinician.npi || '',
      did: clinician.did || '',
      trustScore,
      chainAnchors,
      stateBoards: licenses.map(transformLicense),
      dea: deaRecord ? transformDEA(deaRecord) : null,
      cms: cmsRecord ? transformCMS(cmsRecord) : null,
      payers: payerEnrollments.map(transformPayer),
      lastUpdated: new Date().toISOString(),
    };

    return res.json(bundle);
  } catch (error) {
    console.error('[regulatory][overview] error', error);
    return res.status(500).json({
      error: 'regulatory_overview_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Helper functions

function calculateRegulatoryTrustScore(
  licenses: any[],
  dea: any,
  cms: any,
  payers: any[],
): number {
  let score = 0;
  let factors = 0;

  // License factor (40%)
  if (licenses.length > 0) {
    const activeLicenses = licenses.filter((l) => l.status === 'active').length;
    const licenseScore = activeLicenses / Math.max(licenses.length, 1);
    score += licenseScore * 0.4;
    factors += 0.4;
  }

  // DEA factor (20%)
  if (dea && dea.status === 'active') {
    score += 0.2;
    factors += 0.2;
  }

  // CMS factor (20%)
  if (cms && cms.pecosEnrollmentStatus === 'enrolled') {
    score += 0.2;
    factors += 0.2;
  }

  // Payer factor (20%)
  if (payers.length > 0) {
    const activePayers = payers.filter((p) => p.enrollmentStatus === 'active').length;
    const payerScore = activePayers / Math.max(payers.length, 1);
    score += payerScore * 0.2;
    factors += 0.2;
  }

  // Normalize by factors present
  return factors > 0 ? score / factors : 0;
}

function buildChainAnchorSummary(
  licenses: any[],
  dea: any,
  cms: any,
  payers: any[],
): any {
  const documents: any[] = [];

  licenses.forEach((license) => {
    if (license.chainAnchor) {
      documents.push({
        documentId: license.id,
        documentType: 'license',
        anchorHash: license.chainAnchor.hash,
        anchorDate: license.chainAnchor.createdAt.toISOString(),
        chainStatus: license.chainAnchor.isValid ? 'valid' : 'stale',
      });
    }
  });

  if (dea?.chainAnchor) {
    documents.push({
      documentId: dea.id,
      documentType: 'dea',
      anchorHash: dea.chainAnchor.hash,
      anchorDate: dea.chainAnchor.createdAt.toISOString(),
      chainStatus: dea.chainAnchor.isValid ? 'valid' : 'stale',
    });
  }

  if (cms?.chainAnchor) {
    documents.push({
      documentId: cms.id,
      documentType: 'cms',
      anchorHash: cms.chainAnchor.hash,
      anchorDate: cms.chainAnchor.createdAt.toISOString(),
      chainStatus: cms.chainAnchor.isValid ? 'valid' : 'stale',
    });
  }

  payers.forEach((payer) => {
    if (payer.chainAnchor) {
      documents.push({
        documentId: payer.id,
        documentType: 'payer',
        anchorHash: payer.chainAnchor.hash,
        anchorDate: payer.chainAnchor.createdAt.toISOString(),
        chainStatus: payer.chainAnchor.isValid ? 'valid' : 'stale',
      });
    }
  });

  const valid = documents.filter((d) => d.chainStatus === 'valid').length;
  const stale = documents.filter((d) => d.chainStatus === 'stale').length;
  const lastAnchorDate =
    documents.length > 0
      ? documents.sort((a, b) => new Date(b.anchorDate).getTime() - new Date(a.anchorDate).getTime())[0]
          .anchorDate
      : new Date().toISOString();

  return {
    total: documents.length,
    valid,
    stale,
    lastAnchorDate,
    regulatoryDocuments: documents,
  };
}

function transformLicense(license: any): any {
  return {
    id: license.id,
    state: license.state,
    stateCode: license.stateCode,
    licenseNumber: license.licenseNumber,
    status: license.status,
    expirationDate: license.expirationDate.toISOString(),
    issueDate: license.issueDate.toISOString(),
    compactEligible: license.compactEligible || false,
    compactStatus: license.compactStatus || 'ineligible',
    reVerificationCycle: license.reVerificationCycle || 365,
    evidenceRequirements: license.evidenceRequirements || [],
    missingDocuments: license.missingDocuments || [],
    sanctions: license.sanctions || [],
    disciplineHistory: license.disciplineHistory || [],
    chainAnchor: license.chainAnchor
      ? {
          documentId: license.id,
          documentType: 'license',
          anchorHash: license.chainAnchor.hash,
          anchorDate: license.chainAnchor.createdAt.toISOString(),
          chainStatus: license.chainAnchor.isValid ? 'valid' : 'stale',
        }
      : null,
  };
}

function transformDEA(dea: any): any {
  return {
    deaNumber: dea.deaNumber,
    schedules: dea.schedules || [],
    status: dea.status,
    expirationDate: dea.expirationDate.toISOString(),
    issueDate: dea.issueDate.toISOString(),
    mateActCompleted: dea.mateActCompleted || false,
    mateActCompletionDate: dea.mateActCompletionDate?.toISOString() || null,
    mateActCredits: dea.mateActCredits || 0,
    sanctions: dea.sanctions || [],
    flags: dea.flags || [],
    trustScore: dea.trustScore || 0,
    chainAnchor: dea.chainAnchor
      ? {
          documentId: dea.id,
          documentType: 'dea',
          anchorHash: dea.chainAnchor.hash,
          anchorDate: dea.chainAnchor.createdAt.toISOString(),
          chainStatus: dea.chainAnchor.isValid ? 'valid' : 'stale',
        }
      : null,
  };
}

function transformCMS(cms: any): any {
  return {
    npi: cms.npi,
    pecosEnrollmentStatus: cms.pecosEnrollmentStatus,
    pecosEnrollmentDate: cms.pecosEnrollmentDate?.toISOString() || null,
    providerType: cms.providerType,
    reassignments: cms.reassignments || [],
    revalidationDue: cms.revalidationDue || false,
    revalidationDueDate: cms.revalidationDueDate?.toISOString() || null,
    complianceBadges: cms.complianceBadges || [],
    cms855FormData: cms.cms855FormData || null,
    chainAnchor: cms.chainAnchor
      ? {
          documentId: cms.id,
          documentType: 'cms',
          anchorHash: cms.chainAnchor.hash,
          anchorDate: cms.chainAnchor.createdAt.toISOString(),
          chainStatus: cms.chainAnchor.isValid ? 'valid' : 'stale',
        }
      : null,
  };
}

function transformPayer(payer: any): any {
  return {
    id: payer.id,
    payerName: payer.payerName,
    payerType: payer.payerType,
    state: payer.state,
    enrollmentStatus: payer.enrollmentStatus,
    enrollmentDate: payer.enrollmentDate?.toISOString() || null,
    requiredDocuments: payer.requiredDocuments || [],
    providedDocuments: payer.providedDocuments || [],
    missingDocuments: payer.missingDocuments || [],
    applicationPacketId: payer.applicationPacketId || null,
    chainAnchor: payer.chainAnchor
      ? {
          documentId: payer.id,
          documentType: 'payer',
          anchorHash: payer.chainAnchor.hash,
          anchorDate: payer.chainAnchor.createdAt.toISOString(),
          chainStatus: payer.chainAnchor.isValid ? 'valid' : 'stale',
        }
      : null,
    complianceScore: payer.complianceScore || 0,
    riskLevel: payer.riskLevel || 'medium',
  };
}

export default router;








