/**
 * B248B-PARTNER-014: CoMarketingCampaign model
 *
 * Model for tracking co-marketing campaigns with partners.
 */

import { z } from 'zod';

export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

export const CoMarketingCampaignSchema = z.object({
  id: z.string().cuid(),
  partnerId: z.string().min(1, 'Partner ID is required'),
  name: z.string().min(1, 'Campaign name is required'),
  description: z.string().nullable().optional(),
  startDate: z.date().nullable().optional(),
  endDate: z.date().nullable().optional(),
  budget: z.number().int().positive().nullable().optional(), // Budget in cents
  metrics: z.record(z.any()).nullable().optional(), // Campaign metrics (JSON)
  status: z.nativeEnum(CampaignStatus).default(CampaignStatus.DRAFT),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateCoMarketingCampaignSchema = CoMarketingCampaignSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateCoMarketingCampaignSchema = CoMarketingCampaignSchema.partial().omit({
  id: true,
  partnerId: true,
  createdAt: true,
  updatedAt: true,
});

export type CoMarketingCampaign = z.infer<typeof CoMarketingCampaignSchema>;
export type CreateCoMarketingCampaign = z.infer<typeof CreateCoMarketingCampaignSchema>;
export type UpdateCoMarketingCampaign = z.infer<typeof UpdateCoMarketingCampaignSchema>;

export function validateCoMarketingCampaign(data: unknown): CoMarketingCampaign {
  return CoMarketingCampaignSchema.parse(data);
}

export function validateCreateCoMarketingCampaign(data: unknown): CreateCoMarketingCampaign {
  return CreateCoMarketingCampaignSchema.parse(data);
}

export function validateUpdateCoMarketingCampaign(data: unknown): UpdateCoMarketingCampaign {
  return UpdateCoMarketingCampaignSchema.parse(data);
}

