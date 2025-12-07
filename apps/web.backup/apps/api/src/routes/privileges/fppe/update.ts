import { Prisma, PrismaClient, OrgMembershipRole } from '@prisma/client';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { loadUserSession, requireAuth } from '../../../../../backend/src/middleware/accessGuards';
import { ActiveOrgRequest, requireActiveOrg } from '../../../middleware/requireActiveOrg';
import {
  FPPECaseStatusSchema,
  FPPEChecklistItemUpdateSchema,
  FPPEChecklistSchema,
  applyChecklistUpdates,
  canTransitionFPPECaseStatus,
  normalizeChecklist,
  serializeFPPECase,
} from '../../../../../services/privileging/models/FPPECase.js';

const router = Router();
router.use(loadUserSession, requireAuth, requireActiveOrg);

const prisma = new PrismaClient();

const UpdateFppeCaseSchema = z
  .object({
    status: FPPECaseStatusSchema.optional(),
    evaluatorId: z.string().min(1).optional(),
    notes: z.string().max(2000).optional(),
    checklist: FPPEChecklistSchema.optional(),
    checklistUpdates: z.array(FPPEChecklistItemUpdateSchema).optional(),
  })
  .refine(
    (payload) =>
      payload.status !== undefined ||
      payload.evaluatorId !== undefined ||
      payload.notes !== undefined ||
      payload.checklist !== undefined ||
      (payload.checklistUpdates && payload.checklistUpdates.length > 0),
    {
      message: 'At least one field must be provided',
      path: ['status'],
    }
  );

router.patch('/:caseId', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const orgReq = req as ActiveOrgRequest;
    const validation = UpdateFppeCaseSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid FPPE update payload',
        details: validation.error.errors,
      });
    }

    if (!orgReq.activeOrgId) {
      return res.status(401).json({
        error: 'ActiveOrgRequired',
        message: 'Active organization is required',
      });
    }

    if (
      !orgReq.activeOrgRole ||
      ![OrgMembershipRole.REVIEWER, OrgMembershipRole.ADMIN].includes(orgReq.activeOrgRole)
    ) {
      return res.status(403).json({
        error: 'ReviewerRoleRequired',
        message: 'Only reviewers or org admins can update FPPE cases',
      });
    }

    const fppeCase = await prisma.fPPECase.findUnique({
      where: { id: caseId },
    });

    if (!fppeCase) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'FPPE case not found',
      });
    }

    if (fppeCase.orgId !== orgReq.activeOrgId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'FPPE case does not belong to the active organization',
      });
    }

    const payload = validation.data;
    let nextChecklist = normalizeChecklist(fppeCase.checklist, {
      privilegeCode: fppeCase.privilegeCode,
    });
    let checklistChanged = false;

    if (payload.checklist) {
      nextChecklist = payload.checklist;
      checklistChanged = true;
    } else if (payload.checklistUpdates) {
      nextChecklist = applyChecklistUpdates(nextChecklist, payload.checklistUpdates);
      checklistChanged = true;
    }

    const data: Prisma.FPPECaseUpdateInput = {};

    if (payload.evaluatorId !== undefined) {
      data.evaluatorId = payload.evaluatorId;
    }
    if (payload.notes !== undefined) {
      data.notes = payload.notes;
    }
    if (checklistChanged) {
      data.checklist = nextChecklist as Prisma.InputJsonValue;
    }

    if (payload.status) {
      const transition = canTransitionFPPECaseStatus(fppeCase.status as any, payload.status);
      if (!transition.allowed) {
        return res.status(409).json({
          error: 'InvalidTransition',
          message: transition.reason,
          currentStatus: fppeCase.status,
        });
      }

      data.status = payload.status;
      if (payload.status === 'COMPLETED') {
        data.completedAt = fppeCase.completedAt ?? new Date();
      } else if (payload.status === 'FAILED') {
        data.completedAt = new Date();
      } else if (payload.status === 'OPEN') {
        data.completedAt = null;
      }
    }

    const updated = await prisma.fPPECase.update({
      where: { id: caseId },
      data,
    });

    if (payload.status === 'COMPLETED' || payload.status === 'FAILED') {
      await prisma.auditEvent.create({
        data: {
          type: payload.status === 'COMPLETED' ? 'FPPE_CASE_COMPLETED' : 'FPPE_CASE_FAILED',
          subjectNpi: updated.clinicianId,
          data: {
            fppeCaseId: updated.id,
            orgId: updated.orgId,
            status: updated.status,
            evaluatorId: payload.evaluatorId ?? updated.evaluatorId ?? null,
            completedAt: (updated.completedAt ?? new Date()).toISOString(),
            privilegeCode: updated.privilegeCode,
          } as Prisma.InputJsonValue,
        },
      });
    }

    res.json({
      success: true,
      data: serializeFPPECase(checklistChanged ? { ...updated, checklist: nextChecklist } : updated),
      message: 'FPPE case updated successfully',
    });
  } catch (error) {
    console.error('Error updating FPPE case:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to update FPPE case',
    });
  }
});

export default router;

