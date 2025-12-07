/**
 * B224B-REP-006: ReputationSharingPolicy model
 *
 * Model for managing reputation data sharing policies with consent tracking.
 */

import { z } from 'zod';
import { PrismaClient, RecipientType } from '@prisma/client';

export const RecipientTypeSchema = z.nativeEnum(RecipientType);

export const ReputationSharingPolicySchema = z.object({
  id: z.string(),
  clinicianId: z.string(),
  recipientType: RecipientTypeSchema,
  recipientId: z.string().nullable(),
  allowedMetrics: z.array(z.string()).default([]),
  consentGiven: z.boolean().default(false),
  consentGivenAt: z.date().nullable(),
  expiryDate: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ReputationSharingPolicy = z.infer<typeof ReputationSharingPolicySchema>;

export interface CreateReputationSharingPolicyInput {
  clinicianId: string;
  recipientType: RecipientType;
  recipientId?: string | null;
  allowedMetrics?: string[];
  consentGiven?: boolean;
  expiryDate?: Date | null;
}

export interface UpdateReputationSharingPolicyInput {
  allowedMetrics?: string[];
  consentGiven?: boolean;
  consentGivenAt?: Date | null;
  expiryDate?: Date | null;
}

/**
 * ReputationSharingPolicy service
 */
export class ReputationSharingPolicyService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new sharing policy
   */
  async createPolicy(input: CreateReputationSharingPolicyInput): Promise<ReputationSharingPolicy> {
    const policy = await this.prisma.reputationSharingPolicy.create({
      data: {
        clinicianId: input.clinicianId,
        recipientType: input.recipientType,
        recipientId: input.recipientId ?? null,
        allowedMetrics: input.allowedMetrics ?? [],
        consentGiven: input.consentGiven ?? false,
        consentGivenAt: input.consentGiven ? new Date() : null,
        expiryDate: input.expiryDate ?? null,
      },
    });

    return ReputationSharingPolicySchema.parse(policy);
  }

  /**
   * Update an existing policy
   */
  async updatePolicy(
    id: string,
    input: UpdateReputationSharingPolicyInput
  ): Promise<ReputationSharingPolicy> {
    const updateData: any = {};

    if (input.allowedMetrics !== undefined) {
      updateData.allowedMetrics = input.allowedMetrics;
    }

    if (input.consentGiven !== undefined) {
      updateData.consentGiven = input.consentGiven;
      updateData.consentGivenAt = input.consentGiven ? new Date() : null;
    }

    if (input.consentGivenAt !== undefined) {
      updateData.consentGivenAt = input.consentGivenAt;
    }

    if (input.expiryDate !== undefined) {
      updateData.expiryDate = input.expiryDate;
    }

    const policy = await this.prisma.reputationSharingPolicy.update({
      where: { id },
      data: updateData,
    });

    return ReputationSharingPolicySchema.parse(policy);
  }

  /**
   * Get policy by ID
   */
  async getPolicyById(id: string): Promise<ReputationSharingPolicy | null> {
    const policy = await this.prisma.reputationSharingPolicy.findUnique({
      where: { id },
    });

    return policy ? ReputationSharingPolicySchema.parse(policy) : null;
  }

  /**
   * Get policies for a clinician
   */
  async getPoliciesByClinician(clinicianId: string): Promise<ReputationSharingPolicy[]> {
    const policies = await this.prisma.reputationSharingPolicy.findMany({
      where: { clinicianId },
      orderBy: { createdAt: 'desc' },
    });

    return policies.map((p) => ReputationSharingPolicySchema.parse(p));
  }

  /**
   * Get active policies (consent given and not expired)
   */
  async getActivePolicies(
    clinicianId: string,
    recipientType?: RecipientType,
    recipientId?: string
  ): Promise<ReputationSharingPolicy[]> {
    const now = new Date();
    const where: any = {
      clinicianId,
      consentGiven: true,
      AND: [
        {
          OR: [
            { expiryDate: null },
            { expiryDate: { gt: now } },
          ],
        },
      ],
    };

    if (recipientType) {
      where.recipientType = recipientType;
    }

    if (recipientId !== undefined) {
      where.AND.push({
        OR: [
          { recipientId: recipientId },
          { recipientId: null }, // Policies that apply to all recipients of this type
        ],
      });
    }

    const policies = await this.prisma.reputationSharingPolicy.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return policies.map((p) => ReputationSharingPolicySchema.parse(p));
  }

  /**
   * Delete a policy
   */
  async deletePolicy(id: string): Promise<void> {
    await this.prisma.reputationSharingPolicy.delete({
      where: { id },
    });
  }

  /**
   * Revoke consent for a policy
   */
  async revokeConsent(id: string): Promise<ReputationSharingPolicy> {
    return this.updatePolicy(id, {
      consentGiven: false,
      consentGivenAt: null,
    });
  }
}

