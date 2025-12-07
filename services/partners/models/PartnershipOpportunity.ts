/**
 * B248B-PARTNER-011: PartnershipOpportunity model
 *
 * Model for tracking partnership opportunities with status, value, and assignment.
 */

import { z } from 'zod';

export enum OpportunityStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  WON = 'won',
  LOST = 'lost',
}

export const PartnershipOpportunitySchema = z.object({
  id: z.string().cuid(),
  partnerId: z.string().min(1, 'Partner ID is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.nativeEnum(OpportunityStatus).default(OpportunityStatus.NEW),
  potentialValue: z.number().int().positive().nullable().optional(), // Value in cents
  assignedTo: z.string().cuid().nullable().optional(), // User ID
  createdBy: z.string().cuid().min(1, 'Created by user ID is required'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreatePartnershipOpportunitySchema = PartnershipOpportunitySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdatePartnershipOpportunitySchema = PartnershipOpportunitySchema.partial().omit({
  id: true,
  partnerId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export type PartnershipOpportunity = z.infer<typeof PartnershipOpportunitySchema>;
export type CreatePartnershipOpportunity = z.infer<typeof CreatePartnershipOpportunitySchema>;
export type UpdatePartnershipOpportunity = z.infer<typeof UpdatePartnershipOpportunitySchema>;

export function validatePartnershipOpportunity(data: unknown): PartnershipOpportunity {
  return PartnershipOpportunitySchema.parse(data);
}

export function validateCreatePartnershipOpportunity(data: unknown): CreatePartnershipOpportunity {
  return CreatePartnershipOpportunitySchema.parse(data);
}

export function validateUpdatePartnershipOpportunity(data: unknown): UpdatePartnershipOpportunity {
  return UpdatePartnershipOpportunitySchema.parse(data);
}

