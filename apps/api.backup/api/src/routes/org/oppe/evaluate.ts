/**
 * S72-STRETCH-B-004: FPPE/OPPE Evaluation Forms Backend
 *
 * POST /api/org/:orgId/oppe/evaluate
 *
 * Endpoint for storing FPPE/OPPE evaluation results.
 * Accepts minimal metrics JSON and reviewer comment, updates FPPE/OPPE status,
 * and logs audit event.
 */

import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

/**
 * Schema for FPPE/OPPE evaluation submission
 */
const EvaluateFPPEOPPESchema = z.object({
  type: z.enum(['FPPE', 'OPPE']),
  recordId: z.string().min(1, 'Record ID is required'), // FPPERecord.id or FppeOppe.id
  reviewerDid: z.string().min(1, 'Reviewer DID is required'),
  metrics: z.record(z.any()).optional(), // Minimal metrics JSON
  comment: z.string().optional(), // Reviewer comment
  passed: z.boolean(), // Whether evaluation passed
  nextReviewAt: z.coerce.date().optional(), // For OPPE, when next review is due
});

type EvaluateFPPEOPPEInput = z.infer<typeof EvaluateFPPEOPPESchema>;

/**
 * POST /api/org/:orgId/oppe/evaluate
 * Store FPPE/OPPE evaluation results
 */
router.post('/:orgId/oppe/evaluate', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    // TODO: Add authentication middleware to verify user has review permissions

    // Validate input
    const validation = EvaluateFPPEOPPESchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid evaluation data',
        details: validation.error.errors,
      });
      return;
    }

    const { type, recordId, reviewerDid, metrics, comment, passed, nextReviewAt } = validation.data;

    // Handle FPPE evaluation
    if (type === 'FPPE') {
      const fppeRecord = await prisma.fPPERecord.findUnique({
        where: { id: recordId },
        include: {
          privilegeGranted: true,
        },
      });

      if (!fppeRecord) {
        res.status(404).json({
          error: 'NotFound',
          message: 'FPPE record not found',
        });
        return;
      }

      // Verify orgId matches
      if (fppeRecord.privilegeGranted.orgId !== orgId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'FPPE record does not belong to this organization',
        });
        return;
      }

      // Update FPPE record status
      const updatedFppeRecord = await prisma.fPPERecord.update({
        where: { id: recordId },
        data: {
          status: passed ? 'COMPLETED' : 'CANCELLED',
          endAt: new Date(),
          notes: comment || undefined,
        },
      });

      // Update related PrivilegeGranted status if FPPE failed
      if (!passed) {
        await prisma.privilegeGranted.update({
          where: { id: fppeRecord.privilegeGrantedId },
          data: {
            status: 'HOLD',
            fppeStatus: 'CANCELLED',
          },
        });
      } else {
        await prisma.privilegeGranted.update({
          where: { id: fppeRecord.privilegeGrantedId },
          data: {
            fppeStatus: 'COMPLETED',
          },
        });
      }

      await prisma.oPPECase.updateMany({
        where: {
          clinicianId: fppeOppe.clinicianDid,
          orgId: fppeOppe.orgId,
          status: 'OPEN',
          periodEnd: { lte: new Date() },
        },
        data: {
          status: passed ? 'COMPLETED' : 'FAILED',
          reviewerId,
          reviewedAt: new Date(),
          metrics: (metrics || {}) as Prisma.InputJsonValue,
        },
      });

      // Log audit event
      await prisma.auditEvent.create({
        data: {
          type: 'FPPE_EVALUATION_COMPLETED',
          subjectNpi: fppeRecord.privilegeGranted.clinicianDid,
          data: {
            fppeRecordId: recordId,
            privilegeGrantedId: fppeRecord.privilegeGrantedId,
            orgId,
            reviewerDid,
            passed,
            metrics: metrics || {},
            comment: comment || null,
          } as Prisma.InputJsonValue,
        },
      });

      res.json({
        success: true,
        data: {
          id: updatedFppeRecord.id,
          type: 'FPPE',
          status: updatedFppeRecord.status,
          passed,
          evaluatedAt: new Date().toISOString(),
        },
      });
      return;
    }

    // Handle OPPE evaluation
    if (type === 'OPPE') {
      // First, try to find by FppeOppe record
      const fppeOppe = await prisma.fppeOppe.findFirst({
        where: {
          OR: [{ id: recordId }, { privilegeRequestId: recordId }],
        },
        include: {
          privilegeRequest: {
            include: {
              privilegeGranted: true,
            },
          },
        },
      });

      if (!fppeOppe) {
        res.status(404).json({
          error: 'NotFound',
          message: 'OPPE record not found',
        });
        return;
      }

      // Verify orgId matches
      if (fppeOppe.orgId !== orgId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'OPPE record does not belong to this organization',
        });
        return;
      }

      // Calculate next review date if not provided
      let nextReviewDue = nextReviewAt;
      if (!nextReviewDue) {
        // Use existing schedule if available
        const schedule = await prisma.oPPESchedule.findUnique({
          where: {
            clinicianId_orgId: {
              clinicianId: fppeOppe.clinicianDid,
              orgId: fppeOppe.orgId,
            },
          },
        });

        if (schedule) {
          const lastReview = fppeOppe.oppeLastReviewDate || new Date();
          nextReviewDue = new Date(lastReview);
          nextReviewDue.setMonth(nextReviewDue.getMonth() + schedule.frequencyMonths);
        } else {
          // Default to 12 months
          nextReviewDue = new Date();
          nextReviewDue.setMonth(nextReviewDue.getMonth() + 12);
        }
      }

      // Update FppeOppe record
      const updatedFppeOppe = await prisma.fppeOppe.update({
        where: { id: fppeOppe.id },
        data: {
          oppeStatus: passed ? 'ACTIVE' : 'HOLD',
          oppeLastReviewDate: new Date(),
          oppeNextReviewDue: nextReviewDue,
          oppeMetrics: (metrics || {}) as Prisma.InputJsonValue,
          notes: comment || undefined,
        },
      });

      // Update OPPESchedule if it exists
      const schedule = await prisma.oPPESchedule.findUnique({
        where: {
          clinicianId_orgId: {
            clinicianId: fppeOppe.clinicianDid,
            orgId: fppeOppe.orgId,
          },
        },
      });

      if (schedule) {
        await prisma.oPPESchedule.update({
          where: { id: schedule.id },
          data: {
            nextReviewAt: nextReviewDue,
          },
        });
      }

      const scheduleV2 = await prisma.oPPEScheduleV2.findUnique({
        where: {
          clinicianId_orgId: {
            clinicianId: fppeOppe.clinicianDid,
            orgId: fppeOppe.orgId,
          },
        },
      });

      if (scheduleV2) {
        await prisma.oPPEScheduleV2.update({
          where: { id: scheduleV2.id },
          data: {
            nextDueAt: nextReviewDue,
          },
        });
      }

      // Update related PrivilegeGranted status if OPPE failed
      if (fppeOppe.privilegeRequest.privilegeGranted) {
        if (!passed) {
          await prisma.privilegeGranted.update({
            where: { id: fppeOppe.privilegeRequest.privilegeGranted.id },
            data: {
              status: 'HOLD',
              oppeLastReviewed: new Date(),
            },
          });
        } else {
          await prisma.privilegeGranted.update({
            where: { id: fppeOppe.privilegeRequest.privilegeGranted.id },
            data: {
              oppeLastReviewed: new Date(),
            },
          });
        }
      }

      // Log audit event
      await prisma.auditEvent.create({
        data: {
          type: 'OPPE_EVALUATION_COMPLETED',
          subjectNpi: fppeOppe.clinicianDid,
          data: {
            oppeRecordId: fppeOppe.id,
            orgId,
            reviewerDid,
            passed,
            metrics: metrics || {},
            comment: comment || null,
            nextReviewAt: nextReviewDue,
          } as Prisma.InputJsonValue,
        },
      });

      res.json({
        success: true,
        data: {
          id: updatedFppeOppe.id,
          type: 'OPPE',
          status: updatedFppeOppe.oppeStatus,
          passed,
          nextReviewAt: nextReviewDue,
          evaluatedAt: new Date().toISOString(),
        },
      });
      return;
    }

    // Should not reach here
    res.status(400).json({
      error: 'InvalidType',
      message: 'Evaluation type must be FPPE or OPPE',
    });
  } catch (error) {
    console.error('Error evaluating FPPE/OPPE:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to store evaluation',
    });
  }
});


router.get('/:orgId/oppe/cases', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { status, clinicianId } = req.query;

    const where: Prisma.OPPECaseWhereInput = { orgId };
    if (status) {
      where.status = (status as string).toUpperCase();
    }
    if (clinicianId) {
      where.clinicianId = clinicianId as string;
    }

    const cases = await prisma.oPPECase.findMany({
      where,
      orderBy: [
        { clinicianId: 'asc' },
        { periodEnd: 'desc' },
      ],
      include: {
        schedule: true,
        privilegeGranted: {
          include: {
            privilegeRequest: {
              select: { clinicianDid: true },
            },
          },
        },
      },
    });

    const clinicianIds = Array.from(new Set(cases.map((c) => c.clinicianId)));
    const didLinks = await prisma.didUserLink.findMany({
      where: { did: { in: clinicianIds } },
      include: { user: true },
    });
    const nameMap = new Map<string, string>();
    didLinks.forEach((link) => {
      if (link.user) {
        nameMap.set(link.did, link.user.name);
      }
    });

    const grouped = new Map<string, any>();
    for (const oppeCase of cases) {
      const entry = grouped.get(oppeCase.clinicianId) ?? {
        clinicianId: oppeCase.clinicianId,
        clinicianName: nameMap.get(oppeCase.clinicianId) || oppeCase.clinicianId,
        nextDueAt: oppeCase.schedule?.nextDueAt || null,
        cases: [] as any[],
      };

      entry.cases.push({
        id: oppeCase.id,
        privilegeCode: oppeCase.privilegeCode,
        status: oppeCase.status,
        periodStart: oppeCase.periodStart,
        periodEnd: oppeCase.periodEnd,
        metrics: oppeCase.metrics || {},
      });

      grouped.set(oppeCase.clinicianId, entry);
    }

    const summary = {
      totalCases: cases.length,
      openCases: cases.filter((c) => c.status === 'OPEN').length,
      completedCases: cases.filter((c) => c.status === 'COMPLETED').length,
      failedCases: cases.filter((c) => c.status === 'FAILED').length,
    };

    res.json({
      orgId,
      generatedAt: new Date().toISOString(),
      summary,
      clinicians: Array.from(grouped.values()),
    });
  } catch (error) {
    console.error('Error fetching OPPE cases:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to fetch OPPE cases',
    });
  }
});

export { router as oppeEvaluateRouter };
export default router;

