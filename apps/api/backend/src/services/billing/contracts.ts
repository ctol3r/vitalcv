import { z } from 'zod';
import {
  BILLING_TIERS,
  type BillingFeature,
  type BillingPlan,
  type BillingTier,
} from '@vitalcv/shared/pricing';

export const subscriptionTierSchema = z.enum(BILLING_TIERS);

export const createApiKeyRequestSchema = z.object({
  clinicianId: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  tier: subscriptionTierSchema.optional().default('STARTER'),
});

export type CreateApiKeyRequest = z.infer<typeof createApiKeyRequestSchema>;

export type { BillingFeature, BillingPlan, BillingTier };
