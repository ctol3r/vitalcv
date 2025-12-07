import { PrismaClient, FHIRSubscriptionStatus } from '@prisma/client';
import { clinicianToPractitioner } from '../../fhir/adapter/practitionerAdapter.js';
import { matchesPractitionerCriteria } from './criteria.js';
import { createLogger, serializeError } from '@chai-vc/logging-core';

const prisma = new PrismaClient();
const log = createLogger({ service: 'fhir-subscription-delivery' });

export interface SubscriptionDeliveryJobPayload {
  subscriptionId: string;
  resourceType: 'Practitioner';
  resourceId: string;
  eventType?: 'update' | 'delete';
}

interface NameParts {
  first: string;
  last: string;
  middle?: string[];
}

function splitName(fullName: string | null | undefined): NameParts {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { first: 'Unknown', last: 'Practitioner' };
  }
  if (parts.length === 1) {
    return { first: parts[0], last: parts[0] };
  }

  return {
    first: parts[0],
    last: parts[parts.length - 1],
    middle: parts.slice(1, -1),
  };
}

export async function deliverSubscriptionEvent(
  payload: SubscriptionDeliveryJobPayload,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const subscription = await prisma.fHIRSubscription.findUnique({
    where: { id: payload.subscriptionId },
  });

  if (!subscription) {
    log.warn('Subscription not found for delivery', { subscriptionId: payload.subscriptionId });
    return;
  }

  if (subscription.status !== FHIRSubscriptionStatus.ACTIVE) {
    log.info('Skipping delivery for non-active subscription', {
      subscriptionId: subscription.id,
      status: subscription.status,
    });
    return;
  }

  if (subscription.resourceType !== 'Practitioner') {
    throw new Error(`Unsupported FHIR subscription resource: ${subscription.resourceType}`);
  }

  const clinician = await prisma.user.findUnique({
    where: { id: payload.resourceId },
    include: { clinicianProfile: true },
  });

  if (!clinician || !clinician.clinicianProfile) {
    throw new Error(`Clinician ${payload.resourceId} not found for subscription delivery`);
  }

  const criteriaMatch = matchesPractitionerCriteria(subscription, {
    resourceId: clinician.id,
    npi: clinician.clinicianProfile.npi,
    specialty: clinician.clinicianProfile.specialty,
  });

  if (!criteriaMatch) {
    log.debug('Subscription criteria no longer matches resource', {
      subscriptionId: subscription.id,
      resourceId: clinician.id,
    });
    return;
  }

  const name = splitName(clinician.name);
  const practitionerResource = clinicianToPractitioner({
    id: clinician.id,
    npi: clinician.clinicianProfile.npi ?? undefined,
    name,
    contact: {
      email: clinician.email,
      phone: clinician.phone ?? undefined,
    },
    addresses: [
      {
        state: clinician.clinicianProfile.state,
        country: 'USA',
      },
    ],
    specialties: clinician.clinicianProfile.specialty
      ? [
          {
            code: clinician.clinicianProfile.specialty,
          },
        ]
      : undefined,
  });

  const bundle = {
    resourceType: 'Bundle',
    type: 'history',
    timestamp: new Date().toISOString(),
    meta: {
      tag: [
        {
          system: 'https://vitalcv.health/subscriptions',
          code: subscription.id,
        },
      ],
    },
    entry: [
      {
        fullUrl: `Practitioner/${practitionerResource.id}`,
        resource: practitionerResource,
        request: {
          method: payload.eventType === 'delete' ? 'DELETE' : 'PUT',
          url: `Practitioner/${practitionerResource.id}`,
        },
      },
    ],
  };

  const response = await fetchImpl(subscription.callbackUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-fhir-event': `${payload.resourceType}.${payload.eventType ?? 'update'}`,
      'x-fhir-subscription-id': subscription.id,
    },
    body: JSON.stringify(bundle),
  });

  if (!response.ok) {
    await prisma.fHIRSubscription.update({
      where: { id: subscription.id },
      data: {
        status: FHIRSubscriptionStatus.FAILED,
      },
    });
    throw new Error(
      `Subscription callback responded with ${response.status} ${response.statusText}`
    );
  }

  log.info('Delivered FHIR subscription payload', {
    subscriptionId: subscription.id,
    callbackUrl: subscription.callbackUrl,
    status: response.status,
  });
}

export async function safeDeliverSubscriptionEvent(
  payload: SubscriptionDeliveryJobPayload
): Promise<void> {
  try {
    await deliverSubscriptionEvent(payload);
  } catch (error) {
    log.error('Delivery job failed', {
      subscriptionId: payload.subscriptionId,
      error: serializeError(error),
    });
    throw error;
  }
}

