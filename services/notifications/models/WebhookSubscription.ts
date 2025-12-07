/**
 * B148A-NOTIF-007: WebhookSubscription Model
 *
 * Model for webhook subscriptions by organization and event type.
 */

import { z } from 'zod';

/**
 * Schema for creating a webhook subscription
 */
export const CreateWebhookSubscriptionSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
  eventType: z.string().min(1, 'Event type is required'),
  targetUrl: z.string().url('Invalid URL'),
  secret: z.string().min(1, 'Secret is required'),
});

export type CreateWebhookSubscriptionInput = z.infer<
  typeof CreateWebhookSubscriptionSchema
>;

/**
 * Serialize webhook subscription for API response
 */
export function serializeWebhookSubscription(subscription: {
  id: string;
  orgId: string;
  eventType: string;
  targetUrl: string;
  secret?: string; // Usually omit secret in responses
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: subscription.id,
    orgId: subscription.orgId,
    eventType: subscription.eventType,
    targetUrl: subscription.targetUrl,
    // Do not expose secret in serialization
    isActive: subscription.isActive,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
  };
}

