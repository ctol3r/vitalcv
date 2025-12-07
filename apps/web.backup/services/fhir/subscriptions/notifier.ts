import { PrismaClient, FHIRSubscriptionStatus } from '@prisma/client';
import { createLogger, serializeError } from '@chai-vc/logging-core';
import { enqueueJob } from '../../queue/producer.js';
import { matchesPractitionerCriteria } from './criteria.js';

const prisma = new PrismaClient();
const log = createLogger({ service: 'fhir-subscription-notifier' });

interface QueueOptions {
  eventType?: 'update' | 'delete';
}

export async function queuePractitionerNotifications(
  userId: string,
  options: QueueOptions = {}
): Promise<number> {
  try {
    const clinician = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        clinicianProfile: true,
      },
    });

    if (!clinician || !clinician.clinicianProfile) {
      log.warn('Clinician profile missing for practitioner notification', { userId });
      return 0;
    }

    const subscriptions = await prisma.fHIRSubscription.findMany({
      where: {
        resourceType: 'Practitioner',
        status: FHIRSubscriptionStatus.ACTIVE,
      },
    });

    if (!subscriptions.length) {
      return 0;
    }

    const context = {
      resourceId: userId,
      npi: clinician.clinicianProfile.npi,
      specialty: clinician.clinicianProfile.specialty,
    };

    const matching = subscriptions.filter((subscription) =>
      matchesPractitionerCriteria(subscription, context)
    );

    await Promise.all(
      matching.map((subscription) =>
        enqueueJob('FHIR_SUBSCRIPTION_DELIVER', {
          subscriptionId: subscription.id,
          resourceType: subscription.resourceType,
          resourceId: userId,
          eventType: options.eventType ?? 'update',
        })
      )
    );

    if (matching.length) {
      log.info('Queued practitioner subscription deliveries', {
        userId,
        count: matching.length,
      });
    }

    return matching.length;
  } catch (error) {
    log.error('Failed to queue practitioner notifications', {
      userId,
      error: serializeError(error),
    });
    return 0;
  }
}

