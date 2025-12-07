/**
 * B134A-PRIV-003: API endpoint for organizations to create privilege sets
 * POST /org/privilegeSets
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// Validation schema for privilege set creation
const CreatePrivilegeSetSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  department: z.string().min(1, 'Department is required'),
  procedures: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      category: z.string().optional(),
    })
  ).min(1, 'At least one procedure is required'),
  requirements: z.object({
    minTrainingHours: z.number().optional(),
    boardCertRequired: z.boolean().optional(),
    specificBoardCerts: z.array(z.string()).optional(),
    licenseStates: z.array(z.string()).optional(),
    minimumYearsExperience: z.number().optional(),
    npdbCleanRequired: z.boolean().optional(),
    additionalCriteria: z.record(z.any()).optional(),
  }),
});

/**
 * POST /org/privilegeSets
 * Create a new privilege set for an organization
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = CreatePrivilegeSetSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const data = validationResult.data;

    // Validate dependencies and required evidence
    const validation = validatePrivilegeSetRequirements(data.requirements, data.procedures);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid privilege set configuration',
        details: validation.errors,
      });
    }

    // Check if privilege set with same name already exists for org
    const existing = await prisma.privilegeSet.findUnique({
      where: {
        orgId_name: {
          orgId: data.orgId,
          name: data.name,
        },
      },
    });

    if (existing) {
      return res.status(409).json({
        error: 'Privilege set with this name already exists for this organization',
      });
    }

    // Create privilege set
    const privilegeSet = await prisma.privilegeSet.create({
      data: {
        orgId: data.orgId,
        name: data.name,
        description: data.description,
        department: data.department,
        procedures: data.procedures,
        requirements: data.requirements,
        isActive: true,
      },
    });

    // Create audit event
    await prisma.auditEvent.create({
      data: {
        type: 'PRIVILEGE_SET_CREATED',
        data: {
          privilegeSetId: privilegeSet.id,
          orgId: data.orgId,
          name: data.name,
          department: data.department,
          procedureCount: data.procedures.length,
        },
      },
    });

    res.status(201).json({
      success: true,
      privilegeSet: {
        id: privilegeSet.id,
        orgId: privilegeSet.orgId,
        name: privilegeSet.name,
        description: privilegeSet.description,
        department: privilegeSet.department,
        procedures: privilegeSet.procedures,
        requirements: privilegeSet.requirements,
        isActive: privilegeSet.isActive,
        createdAt: privilegeSet.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating privilege set:', error);
    res.status(500).json({
      error: 'Failed to create privilege set',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /org/privilegeSets
 * List privilege sets for an organization
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { orgId, department, isActive } = req.query;

    if (!orgId) {
      return res.status(400).json({
        error: 'orgId query parameter is required',
      });
    }

    const where: any = {
      orgId: orgId as string,
    };

    if (department) {
      where.department = department as string;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const privilegeSets = await prisma.privilegeSet.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { privilegeRequests: true },
        },
      },
    });

    res.json({
      success: true,
      privilegeSets: privilegeSets.map((ps) => ({
        id: ps.id,
        orgId: ps.orgId,
        name: ps.name,
        description: ps.description,
        department: ps.department,
        procedures: ps.procedures,
        requirements: ps.requirements,
        isActive: ps.isActive,
        requestCount: ps._count.privilegeRequests,
        createdAt: ps.createdAt,
        updatedAt: ps.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching privilege sets:', error);
    res.status(500).json({
      error: 'Failed to fetch privilege sets',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /org/privilegeSets/:id
 * Get a specific privilege set
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const privilegeSet = await prisma.privilegeSet.findUnique({
      where: { id },
      include: {
        privilegeRequests: {
          select: {
            id: true,
            clinicianDid: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!privilegeSet) {
      return res.status(404).json({
        error: 'Privilege set not found',
      });
    }

    res.json({
      success: true,
      privilegeSet: {
        id: privilegeSet.id,
        orgId: privilegeSet.orgId,
        name: privilegeSet.name,
        description: privilegeSet.description,
        department: privilegeSet.department,
        procedures: privilegeSet.procedures,
        requirements: privilegeSet.requirements,
        isActive: privilegeSet.isActive,
        recentRequests: privilegeSet.privilegeRequests,
        createdAt: privilegeSet.createdAt,
        updatedAt: privilegeSet.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching privilege set:', error);
    res.status(500).json({
      error: 'Failed to fetch privilege set',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /org/privilegeSets/:id
 * Update a privilege set
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, procedures, requirements, isActive } = req.body;

    const privilegeSet = await prisma.privilegeSet.findUnique({
      where: { id },
    });

    if (!privilegeSet) {
      return res.status(404).json({
        error: 'Privilege set not found',
      });
    }

    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (procedures !== undefined) updateData.procedures = procedures;
    if (requirements !== undefined) updateData.requirements = requirements;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await prisma.privilegeSet.update({
      where: { id },
      data: updateData,
    });

    // Audit event
    await prisma.auditEvent.create({
      data: {
        type: 'PRIVILEGE_SET_UPDATED',
        data: {
          privilegeSetId: id,
          updates: Object.keys(updateData),
        },
      },
    });

    res.json({
      success: true,
      privilegeSet: updated,
    });
  } catch (error) {
    console.error('Error updating privilege set:', error);
    res.status(500).json({
      error: 'Failed to update privilege set',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Validate privilege set requirements and procedures
 */
function validatePrivilegeSetRequirements(
  requirements: any,
  procedures: any[]
): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  // Ensure at least one meaningful requirement is set
  const hasRequirements =
    requirements.minTrainingHours ||
    requirements.boardCertRequired ||
    requirements.licenseStates?.length > 0 ||
    requirements.minimumYearsExperience ||
    requirements.npdbCleanRequired;

  if (!hasRequirements) {
    errors.push('At least one requirement must be specified');
  }

  // Validate license states format
  if (requirements.licenseStates) {
    const validStates = requirements.licenseStates.every(
      (state: string) => /^[A-Z]{2}$/.test(state)
    );
    if (!validStates) {
      errors.push('License states must be two-letter state codes (e.g., CA, NY)');
    }
  }

  // Validate procedures have required fields
  const validProcedures = procedures.every(
    (proc) => proc.code && proc.name
  );
  if (!validProcedures) {
    errors.push('All procedures must have code and name fields');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export { router as privilegeSetsRouter };

