import { PrismaClient } from '@prisma/client';
import { Router, Request, Response } from 'express';
import { serializeFPPECase } from '../../../../../services/privileging/models/FPPECase.js';

const router = Router();
const prisma = new PrismaClient();

router.get('/:orgId/fppe/cases', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { status, overdue } = req.query;

    const where: any = { orgId };
    if (status && typeof status === 'string' && status.toUpperCase() !== 'OVERDUE') {
      where.status = status.toUpperCase();
    }

    const cases = await prisma.fPPECase.findMany({
      where,
      orderBy: [{ dueAt: 'asc' }],
      include: {
        privilegeGranted: {
          include: {
            privilegeRequest: {
              include: {
                privilegeSet: true,
                privilegeSetV2: true,
              },
            },
          },
        },
      },
    });

    const now = Date.now();
    const requireOverdue =
      String(overdue).toLowerCase() === 'true' || String(status).toUpperCase() === 'OVERDUE';

    const filtered = cases.filter((record) => {
      if (!requireOverdue) {
        return true;
      }
      return record.status !== 'COMPLETED' && record.dueAt.getTime() < now;
    });

    const clinicianIds = Array.from(new Set(filtered.map((record) => record.clinicianId)));
    const didLinks = clinicianIds.length
      ? await prisma.didUserLink.findMany({
          where: { did: { in: clinicianIds } },
          include: { user: true },
        })
      : [];
    const nameMap = new Map<string, string>();
    for (const link of didLinks) {
      if (link.user?.name) {
        nameMap.set(link.did, link.user.name);
      }
    }

    const payload = filtered.map((record) => {
      const serialized = serializeFPPECase(record);
      return {
        ...serialized,
        clinicianName: nameMap.get(record.clinicianId) ?? record.clinicianId,
        privilegeName:
          record.privilegeGranted?.privilegeRequest?.privilegeSet?.name ??
          record.privilegeGranted?.privilegeRequest?.privilegeSetV2?.name ??
          record.privilegeCode,
      };
    });

    const summary = {
      totalCases: filtered.length,
      openCases: filtered.filter((c) => c.status === 'OPEN').length,
      inReviewCases: filtered.filter((c) => c.status === 'IN_REVIEW').length,
      completedCases: filtered.filter((c) => c.status === 'COMPLETED').length,
      failedCases: filtered.filter((c) => c.status === 'FAILED').length,
      overdueCases: filtered.filter((c) => c.isOverdue).length,
    };

    res.json({
      orgId,
      generatedAt: new Date().toISOString(),
      summary,
      cases: payload,
    });
  } catch (error) {
    console.error('Error fetching FPPE cases:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to fetch FPPE cases',
    });
  }
});

router.get('/:orgId/fppe/cases/:caseId', async (req: Request, res: Response) => {
  try {
    const { orgId, caseId } = req.params;

    const record = await prisma.fPPECase.findUnique({
      where: { id: caseId },
      include: {
        privilegeGranted: {
          include: {
            privilegeRequest: {
              include: {
                privilegeSet: true,
                privilegeSetV2: true,
              },
            },
          },
        },
      },
    });

    if (!record || record.orgId !== orgId) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'FPPE case not found',
      });
    }

    const nameLink = await prisma.didUserLink.findFirst({
      where: { did: record.clinicianId },
      include: { user: true },
    });

    const privilegeName =
      record.privilegeGranted?.privilegeRequest?.privilegeSet?.name ??
      record.privilegeGranted?.privilegeRequest?.privilegeSetV2?.name ??
      record.privilegeCode;

    res.json({
      orgId,
      generatedAt: new Date().toISOString(),
      case: {
        ...serializeFPPECase(record),
        clinicianName: nameLink?.user?.name ?? record.clinicianId,
        privilegeName,
      },
    });
  } catch (error) {
    console.error('Error fetching FPPE case detail:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to fetch FPPE case detail',
    });
  }
});

export default router;

