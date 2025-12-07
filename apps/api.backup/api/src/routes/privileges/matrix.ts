import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { describePrerequisite } from '../../../../../services/privileging/models/PrivilegeMatrix.js';

const router = Router();
const prisma = new PrismaClient();

router.get('/matrix', async (req: Request, res: Response) => {
  try {
    const { specialty, search, page = '1', limit = '50', includeInactive } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (specialty) {
      where.specialty = {
        equals: specialty as string,
        mode: 'insensitive',
      };
    }

    if (!includeInactive || includeInactive === 'false') {
      where.isActive = true;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { privilegeCode: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [privileges, total] = await Promise.all([
      prisma.privilegeMatrix.findMany({
        where,
        orderBy: [{ specialty: 'asc' }, { privilegeCode: 'asc' }],
        skip,
        take: limitNum,
      }),
      prisma.privilegeMatrix.count({ where }),
    ]);

    res.json({
      success: true,
      data: privileges.map((privilege) => ({
        ...privilege,
        prerequisiteDescriptions: privilege.prerequisites.map((p: any) => describePrerequisite(p)),
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching privilege matrix:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to fetch privilege matrix',
    });
  }
});

export default router;

