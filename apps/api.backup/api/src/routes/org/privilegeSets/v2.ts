import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  CreatePrivilegeSetV2Schema,
  UpdatePrivilegeSetV2Schema,
  serializePrivilegeSetV2,
  normalizePrivilegeCodes,
} from '../../../../../../services/privileging/models/PrivilegeSetV2.js';

const router = Router();
const prisma = new PrismaClient();

function mapPrivileges(records: any[]) {
  return records.map((record) => ({
    ...record.privilegeMatrix,
    privilegeCode: record.privilegeCode,
  }));
}

router.post('/:orgId/privilege-sets/v2', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const payload = { ...req.body, orgId };
    const validation = CreatePrivilegeSetV2Schema.safeParse(payload);

    if (!validation.success) {
      res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid privilege set payload',
        details: validation.error.errors,
      });
      return;
    }

    const normalizedCodes = normalizePrivilegeCodes(validation.data.privilegeCodes);
    const matrixEntries = await prisma.privilegeMatrix.findMany({
      where: {
        privilegeCode: {
          in: normalizedCodes,
        },
        isActive: true,
      },
    });

    if (matrixEntries.length !== normalizedCodes.length) {
      res.status(400).json({
        error: 'ValidationError',
        message: 'One or more privilege codes do not exist in the matrix',
      });
      return;
    }

    const matrixMap = Object.fromEntries(matrixEntries.map((entry) => [entry.privilegeCode, entry]));

    const privilegeSet = await prisma.$transaction(async (tx) => {
      const created = await tx.privilegeSetV2.create({
        data: {
          orgId,
          name: validation.data.name,
          specialty: validation.data.specialty,
          description: validation.data.description,
          isActive: validation.data.isActive ?? true,
        },
      });

      await tx.privilegeSetV2Privilege.createMany({
        data: normalizedCodes.map((code) => ({
          privilegeSetV2Id: created.id,
          privilegeMatrixId: matrixMap[code].id,
          privilegeCode: code,
        })),
      });

      return created;
    });

    res.status(201).json({
      success: true,
      data: serializePrivilegeSetV2(privilegeSet, matrixEntries),
    });
  } catch (error) {
    console.error('Error creating PrivilegeSetV2:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to create privilege set v2',
    });
  }
});

router.get('/:orgId/privilege-sets/v2', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { specialty, isActive } = req.query;

    const where: any = { orgId };
    if (specialty) {
      where.specialty = specialty;
    }
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const privilegeSets = await prisma.privilegeSetV2.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        privileges: {
          include: {
            privilegeMatrix: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: privilegeSets.map((set) =>
        serializePrivilegeSetV2(
          set,
          mapPrivileges(set.privileges)
        )
      ),
    });
  } catch (error) {
    console.error('Error listing PrivilegeSetV2:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to list privilege sets',
    });
  }
});

router.get('/:orgId/privilege-sets/v2/:id', async (req: Request, res: Response) => {
  try {
    const { orgId, id } = req.params;

    const privilegeSet = await prisma.privilegeSetV2.findFirst({
      where: { id, orgId },
      include: {
        privileges: {
          include: {
            privilegeMatrix: true,
          },
        },
      },
    });

    if (!privilegeSet) {
      res.status(404).json({
        error: 'NotFound',
        message: 'Privilege set v2 not found',
      });
      return;
    }

    res.json({
      success: true,
      data: serializePrivilegeSetV2(privilegeSet, mapPrivileges(privilegeSet.privileges)),
    });
  } catch (error) {
    console.error('Error fetching PrivilegeSetV2:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to fetch privilege set',
    });
  }
});

router.patch('/:orgId/privilege-sets/v2/:id', async (req: Request, res: Response) => {
  try {
    const { orgId, id } = req.params;
    const validation = UpdatePrivilegeSetV2Schema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid payload',
        details: validation.error.errors,
      });
      return;
    }

    const existing = await prisma.privilegeSetV2.findFirst({
      where: { id, orgId },
      include: {
        privileges: true,
      },
    });

    if (!existing) {
      res.status(404).json({
        error: 'NotFound',
        message: 'Privilege set v2 not found',
      });
      return;
    }

    const updatePayload: any = { ...validation.data };

    let matrixEntries: any[] | undefined;

    if (validation.data.privilegeCodes) {
      const normalized = normalizePrivilegeCodes(validation.data.privilegeCodes);
      matrixEntries = await prisma.privilegeMatrix.findMany({
        where: {
          privilegeCode: {
            in: normalized,
          },
        },
      });

      if (matrixEntries.length !== normalized.length) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'One or more privilege codes do not exist in the matrix',
        });
        return;
      }

      updatePayload.privileges = {
        deleteMany: {},
        createMany: {
          data: normalized.map((code) => ({
            privilegeCode: code,
            privilegeMatrixId: matrixEntries!.find((entry) => entry.privilegeCode === code)!.id,
          })),
        },
      };
    }

    const updated = await prisma.privilegeSetV2.update({
      where: { id },
      data: updatePayload,
      include: {
        privileges: {
          include: {
            privilegeMatrix: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: serializePrivilegeSetV2(
        updated,
        mapPrivileges(updated.privileges)
      ),
    });
  } catch (error) {
    console.error('Error updating PrivilegeSetV2:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to update privilege set',
    });
  }
});

export default router;

