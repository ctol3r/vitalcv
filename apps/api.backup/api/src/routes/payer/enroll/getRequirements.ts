import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { loadUserSession, requireAuth } from '../../../../../../backend/src/middleware/accessGuards';
import { ActiveOrgRequest, requireActiveOrg } from '../../../middleware/requireActiveOrg';
import { checkEnrollmentRequirements } from '../../../../../../services/payer/requirementsEngine.js';
import { parseCaqhProfileFields } from '../../../../../../services/payer/models/CAQHProfile.js';
import { parseRequirementDefinitions } from '../../../../../../services/payer/models/PayerRequirements.js';
import { getDemoCaqhProfile } from '../../../../../../services/payer/stub/caqhStub.js';
import type { PecosEnrollmentStatus } from '../../../../../../services/payer/pecosClient.js';

const router = Router();
const prisma = new PrismaClient();

router.use(loadUserSession, requireAuth, requireActiveOrg);

router.get('/:id/requirements', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (id === 'demo') {
      const demoPayload = await buildDemoResponse();
      return res.json(demoPayload);
    }

    const activeOrgId = (req as ActiveOrgRequest).activeOrgId as string;
    const enrollment = await prisma.payerEnrollment.findUnique({
      where: { id },
      include: {
        payer: true,
      },
    });

    if (!enrollment) {
      return res.status(404).json({ success: false, error: 'Enrollment not found' });
    }

    if (enrollment.orgId !== activeOrgId) {
      return res.status(403).json({ success: false, error: 'org_mismatch' });
    }

    const clinicianProfile = await fetchClinicianProfile(enrollment.clinicianDid);
    const caqhFields = await fetchCaqhFields(enrollment, clinicianProfile?.id);
    const payerRequirementTemplates = await fetchPayerRequirementDefinitions(
      enrollment.payerId,
      clinicianProfile?.specialty
    );

    const pecosStatus = buildPecosStatus(enrollment, clinicianProfile?.npi, clinicianProfile?.specialty);

    const checkInput = {
      payerId: enrollment.payerId,
      clinicianDid: enrollment.clinicianDid,
      specialty: clinicianProfile?.specialty || enrollment.payer.specialty[0] || '207R00000X',
      state: clinicianProfile?.state || enrollment.payer.states[0] || 'CA',
      caqhFields,
      pecosStatus,
      clinicianProfile: clinicianProfile
        ? {
            id: clinicianProfile.id,
            npi: clinicianProfile.npi,
            specialty: clinicianProfile.specialty,
            state: clinicianProfile.state,
            fullName: clinicianProfile.user?.name,
          }
        : undefined,
      payerRequirements: payerRequirementTemplates,
    };

    const evaluation = await checkEnrollmentRequirements(checkInput, enrollment.payer as any);

    return res.json({
      success: true,
      data: {
        enrollment: {
          id: enrollment.id,
          payerId: enrollment.payerId,
          clinicianDid: enrollment.clinicianDid,
          status: enrollment.status,
        },
        payer: {
          id: enrollment.payer.id,
          name: enrollment.payer.name,
          requiresCaqh: enrollment.payer.requiresCaqh,
          requiresPecos: enrollment.payer.requiresPecos,
        },
        clinician: clinicianProfile
          ? {
              id: clinicianProfile.id,
              specialty: clinicianProfile.specialty,
              state: clinicianProfile.state,
              npi: clinicianProfile.npi,
            }
          : null,
        summary: {
          overallStatus: evaluation.overallStatus,
          eligible: evaluation.eligibleForEnrollment,
          warnings: evaluation.warnings,
          evaluatedAt: evaluation.timestamp,
        },
        requirements: evaluation.results.map((reqResult) => ({
          name: reqResult.requirement,
          status: reqResult.status,
          details: reqResult.details,
          severity: reqResult.severity || 'medium',
          met: reqResult.status === 'PASS',
          nextAction: reqResult.nextAction || null,
          source: reqResult.source || 'system',
        })),
      },
    });
  } catch (error) {
    console.error('Failed to compute payer requirements', error);
    res.status(500).json({
      success: false,
      error: 'requirements_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

async function fetchClinicianProfile(clinicianDid: string) {
  const didLink = await prisma.didUserLink.findUnique({ where: { did: clinicianDid } });
  if (!didLink) return null;

  return prisma.clinicianProfile.findUnique({
    where: { userId: didLink.userId },
    include: {
      user: true,
    },
  });
}

async function fetchCaqhFields(enrollment: { caqhId: string | null }, clinicianProfileId?: string | null) {
  const clauses = [
    enrollment.caqhId ? { caqhId: enrollment.caqhId } : null,
    clinicianProfileId ? { clinicianId: clinicianProfileId } : null,
  ].filter(Boolean) as any[];

  if (clauses.length > 0) {
    const caqhRecord = await prisma.caqhProfile.findFirst({
      where: { OR: clauses },
      orderBy: { lastSyncedAt: 'desc' },
    });

    if (caqhRecord) {
      return parseCaqhProfileFields(caqhRecord.fields as unknown);
    }
  }

  return getDemoCaqhProfile().fields;
}

async function fetchPayerRequirementDefinitions(payerId: string, specialty?: string | null) {
  const specialties = [specialty, 'ALL'].filter(Boolean) as string[];
  if (specialties.length === 0) {
    specialties.push('ALL');
  }

  const templates = await prisma.payerRequirement.findMany({
    where: {
      payerId,
      specialty: { in: specialties },
    },
    orderBy: {
      specialty: 'desc',
    },
  });

  return templates.flatMap((template) =>
    parseRequirementDefinitions(template.requirements as unknown)
  );
}

function buildPecosStatus(
  enrollment: { pecosStatus: string | null; pecosEnrollmentId: string | null; pecosId: string | null; revalidationDueAt: Date | null },
  npi?: string | null,
  specialty?: string | null
): PecosEnrollmentStatus | undefined {
  if (!enrollment.pecosStatus) return undefined;

  return {
    pecosEnrollmentId: enrollment.pecosEnrollmentId || enrollment.pecosId || 'UNKNOWN',
    npi: npi || 'UNKNOWN',
    enrollmentType: '855I',
    status: enrollment.pecosStatus as PecosEnrollmentStatus['status'],
    effectiveDate: null,
    expirationDate: null,
    revalidationDueDate: enrollment.revalidationDueAt
      ? enrollment.revalidationDueAt.toISOString()
      : null,
    lastRevalidationDate: null,
    cycle: '5year',
    specialty: specialty || '207R00000X',
    practiceLocations: [],
    details: {},
  } as PecosEnrollmentStatus;
}

async function buildDemoResponse() {
  const demoCaqh = getDemoCaqhProfile();
  const demoPayer = {
    id: 'demo-payer',
    payerId: 'DEMO_PAYER',
    name: 'Demo Health Plan',
    planTypes: ['HMO'],
    enrollmentEndpoint: null,
    x12SubmitEndpoint: null,
    contactInfo: null,
    requiresCaqh: true,
    requiresPecos: false,
    specialty: [],
    states: ['ALL'],
    metadata: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as const;

  const evaluation = await checkEnrollmentRequirements(
    {
      payerId: demoPayer.payerId,
      clinicianDid: demoCaqh.clinicianId,
      specialty: demoCaqh.fields.specialties[0]?.taxonomyCode || '207R00000X',
      state: 'CA',
      caqhFields: demoCaqh.fields,
      payerRequirements: [
        {
          id: 'demo-license',
          type: 'STATE_LICENSE',
          label: 'California License',
          description: 'Maintain active California license',
          severity: 'critical',
          metadata: { state: 'CA' },
        },
        {
          id: 'demo-dea',
          type: 'DEA_REGISTRATION',
          label: 'DEA Registration',
          description: 'DEA must be current',
          severity: 'high',
        },
      ],
    },
    demoPayer as any
  );

  return {
    success: true,
    data: {
      enrollment: {
        id: 'demo',
        payerId: demoPayer.payerId,
        clinicianDid: demoCaqh.clinicianId,
        status: 'DRAFT',
      },
      payer: {
        id: demoPayer.id,
        name: demoPayer.name,
        requiresCaqh: true,
        requiresPecos: false,
      },
      clinician: {
        specialty: demoCaqh.fields.specialties[0]?.specialty || 'Internal Medicine',
        state: 'CA',
      },
      summary: {
        overallStatus: evaluation.overallStatus,
        eligible: evaluation.eligibleForEnrollment,
        warnings: evaluation.warnings,
        evaluatedAt: evaluation.timestamp,
      },
      requirements: evaluation.results.map((reqResult) => ({
        name: reqResult.requirement,
        status: reqResult.status,
        details: reqResult.details,
        severity: reqResult.severity || 'medium',
        met: reqResult.status === 'PASS',
        nextAction: reqResult.nextAction || null,
        source: reqResult.source || 'system',
      })),
    },
  };
}

export default router;
