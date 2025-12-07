import { z } from 'zod';
import type { FHIRSubscription } from '@prisma/client';

export const FHIR_SUBSCRIPTION_RESOURCE_TYPES = [
  'Practitioner',
  'PractitionerRole',
  'Organization',
  'Endpoint',
] as const;

export const FHIRSubscriptionStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'FAILED']);

export const CreateFHIRSubscriptionSchema = z.object({
  resourceType: z.enum(FHIR_SUBSCRIPTION_RESOURCE_TYPES),
  criteria: z.string().min(1, 'criteria is required'),
  callbackUrl: z
    .string()
    .url('callbackUrl must be a valid URL')
    .refine((value) => {
      try {
        return new URL(value).protocol === 'https:';
      } catch {
        return false;
      }
    }, 'callbackUrl must use https://'),
});

export type CreateFHIRSubscriptionInput = z.infer<typeof CreateFHIRSubscriptionSchema>;

export function serializeFHIRSubscription(subscription: FHIRSubscription) {
  return {
    id: subscription.id,
    resourceType: subscription.resourceType,
    criteria: subscription.criteria,
    callbackUrl: subscription.callbackUrl,
    status: subscription.status,
    lastHandshakeAt: subscription.lastHandshakeAt?.toISOString() ?? null,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
  };
}
