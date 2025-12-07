import { Router, Request, Response } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { z } from 'zod';
import { upsertClinicianProfile } from '../../../../../services/users/models/ClinicianProfile';
import { queuePractitionerNotifications } from '../../../../../services/fhir/subscriptions/notifier.js';

const router = Router();
const prisma = new PrismaClient();

const UpdateClinicianProfileSchema = z.object({
  specialty: z
    .string()
    .trim()
    .regex(/^[0-9A-Z]{10}$/i, 'Specialty must be a valid taxonomy code'),
  state: z
    .string()
    .trim()
    .length(2, 'State must be a 2-letter code'),
  bio: z
    .string()
    .max(2000, 'Bio must be 2000 characters or less')
    .optional(),
});

router.patch('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).userId;

    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Active session required',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== UserRole.CLINICIAN) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only clinicians can update clinician profiles',
      });
    }

    const payload = UpdateClinicianProfileSchema.parse(req.body);

    const existing = await prisma.clinicianProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'PROFILE_NOT_FOUND',
        message: 'Clinician profile not found',
      });
    }

    const updatedProfile = await upsertClinicianProfile({
      userId,
      npi: existing.npi,
      specialty: payload.specialty.toUpperCase(),
      state: payload.state,
      bio: payload.bio,
    });

    await prisma.auditEvent.create({
      data: {
        type: 'clinician_profile.updated',
        userId,
        data: {
          specialty: updatedProfile.specialty,
          state: updatedProfile.state,
        },
      },
    });

    try {
      await queuePractitionerNotifications(userId);
    } catch (notifyError) {
      console.warn('[PATCH /clinician/profile] Failed to queue FHIR subscriptions', notifyError);
    }

    return res.json({
      success: true,
      profile: {
        npi: updatedProfile.npi,
        specialty: updatedProfile.specialty,
        state: updatedProfile.state,
        bio: updatedProfile.bio,
        updatedAt: updatedProfile.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    console.error('[PATCH /clinician/profile] failure', error);
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to update clinician profile',
    });
  }
});

export default router;

