import { PrismaClient } from '@prisma/client';
import { createNotification } from '../../notifications/notificationService';
import { getServiceLogger } from '../../logging/serviceLogger';

const log = getServiceLogger('safety/triggers/helpers');

export async function notifyClinicianSafetyEvent(
  prisma: PrismaClient,
  clinicianId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const clinician = await prisma.clinicianProfile.findUnique({
    where: { id: clinicianId },
    include: { user: true },
  });

  if (!clinician?.userId) {
    log.warn('[notifyClinicianSafetyEvent] Missing user mapping for clinician', { clinicianId, type });
    return;
  }

  await createNotification(clinician.userId, type, payload);
}

