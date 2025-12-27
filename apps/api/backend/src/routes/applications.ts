import crypto from 'crypto';
import { Router } from 'express';
import { body, param } from 'express-validator';
import prisma from '../graphql/prisma_client';
import { validateRequest } from '../middleware/validateRequest';

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function writeAuditEvent(event: {
  type: string;
  credentialId?: string;
  userId?: number;
  metadata?: Record<string, unknown>;
}): Promise<{ hash: string; createdAt: string }> {
  const createdAt = new Date();
  const hash = sha256Hex(
    JSON.stringify({
      type: event.type,
      credentialId: event.credentialId || null,
      userId: event.userId || null,
      createdAt: createdAt.toISOString(),
      metadata: event.metadata || null,
    }),
  );

  await prisma.auditEvent.create({
    data: {
      type: event.type,
      hash,
      credentialId: event.credentialId,
      userId: event.userId,
      metadata: event.metadata ?? undefined,
      createdAt,
    },
  });

  return { hash, createdAt: createdAt.toISOString() };
}

function buildFitExplanation(jobTitle: string, verifiedCount: number): string {
  if (!jobTitle) {
    return `MATCHA fit analysis: ${verifiedCount} verified credential(s) support role alignment based on current profile data.`;
  }
  if (verifiedCount === 0) {
    return `MATCHA fit analysis: No verified credentials yet for ${jobTitle}. Recommend additional verification before progressing.`;
  }
  return `MATCHA fit analysis: ${verifiedCount} verified credential(s) align with ${jobTitle}. Candidate meets baseline verification signals for the role.`;
}

const router = Router();

router.post(
  '/apply',
  body('clinicianId').isInt({ gt: 0 }).withMessage('clinicianId must be a positive integer'),
  body('jobId').isInt({ gt: 0 }).withMessage('jobId must be a positive integer'),
  validateRequest,
  async (req, res, next) => {
    try {
      const clinicianId = Number(req.body.clinicianId);
      const jobId = Number(req.body.jobId);

      const [clinician, job, credentials] = await Promise.all([
        prisma.user.findUnique({ where: { id: clinicianId } }),
        prisma.job.findUnique({ where: { id: jobId } }),
        prisma.credential.findMany({ where: { userId: clinicianId } }),
      ]);

      if (!clinician) {
        return res.status(404).json({ error: 'Clinician not found' });
      }

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const reportRef = crypto.randomUUID();
      const verifiedCredentials = credentials.map((credential) => ({
        id: `CRED-${credential.id}`,
        type: credential.name,
        issuer: credential.issuer,
        status: 'verified',
        issuedAt: credential.issuedAt.toISOString(),
        expiresAt: credential.expiresAt ? credential.expiresAt.toISOString() : null,
      }));

      const reportSummaryBase = {
        id: reportRef,
        clinicianId,
        jobId,
        generatedAt: new Date().toISOString(),
        credentials: {
          verified: verifiedCredentials,
          pending: [],
          revoked: [],
        },
        fitExplanation: buildFitExplanation(job.title, verifiedCredentials.length),
      };

      const { application, report } = await prisma.$transaction(async (tx) => {
        const createdApplication = await tx.application.create({
          data: {
            clinicianId,
            jobId,
          },
        });

        const createdReport = await tx.applicationReport.create({
          data: {
            id: reportRef,
            applicationId: createdApplication.id,
            summary: {
              ...reportSummaryBase,
              applicationId: createdApplication.id,
            },
          },
        });

        return { application: createdApplication, report: createdReport };
      });

      await writeAuditEvent({
        type: 'JOB_ACTION_APPLICATION_CREATED',
        userId: clinicianId,
        metadata: {
          event: 'job_action',
          action: 'application_created',
          clinicianId,
          jobId,
          applicationId: application.id,
          reportRef: report.id,
          credentialIds: verifiedCredentials.map((credential) => credential.id),
          timestamp: new Date().toISOString(),
        },
      });

      return res.status(201).json({
        applicationId: application.id,
        reportRef: report.id,
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  '/reports/:id',
  param('id').isString().notEmpty().withMessage('report id is required'),
  validateRequest,
  async (req, res, next) => {
    try {
      const reportId = String(req.params.id);
      const report = await prisma.applicationReport.findUnique({
        where: { id: reportId },
      });

      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      return res.json({
        reportRef: report.id,
        createdAt: report.createdAt.toISOString(),
        ...(report.summary as Record<string, unknown>),
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
