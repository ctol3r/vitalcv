/**
 * B248B-PARTNER-013: PartnershipProposal model
 *
 * Model for partnership proposals linked to opportunities.
 */

import { z } from 'zod';

export enum ProposalStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

export const PartnershipProposalSchema = z.object({
  id: z.string().cuid(),
  opportunityId: z.string().cuid().min(1, 'Opportunity ID is required'),
  proposalDocId: z.string().nullable().optional(), // Document ID or URL
  status: z.nativeEnum(ProposalStatus).default(ProposalStatus.DRAFT),
  submittedAt: z.date().nullable().optional(),
  decisionAt: z.date().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreatePartnershipProposalSchema = PartnershipProposalSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdatePartnershipProposalSchema = PartnershipProposalSchema.partial().omit({
  id: true,
  opportunityId: true,
  createdAt: true,
  updatedAt: true,
});

export type PartnershipProposal = z.infer<typeof PartnershipProposalSchema>;
export type CreatePartnershipProposal = z.infer<typeof CreatePartnershipProposalSchema>;
export type UpdatePartnershipProposal = z.infer<typeof UpdatePartnershipProposalSchema>;

export function validatePartnershipProposal(data: unknown): PartnershipProposal {
  return PartnershipProposalSchema.parse(data);
}

export function validateCreatePartnershipProposal(data: unknown): CreatePartnershipProposal {
  return CreatePartnershipProposalSchema.parse(data);
}

export function validateUpdatePartnershipProposal(data: unknown): UpdatePartnershipProposal {
  return UpdatePartnershipProposalSchema.parse(data);
}

