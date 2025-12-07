/**
 * B234B-COMM-006: FollowAndEndorsement Model
 *
 * Model for following clinicians/organizations and endorsing specific credentials.
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

/**
 * Schema for creating a follow relationship
 */
export const CreateFollowSchema = z.object({
  followerId: z.string().min(1, 'Follower ID is required'),
  followeeId: z.string().min(1, 'Followee ID is required'),
  followeeType: z.enum(['user', 'organization']).default('user'),
  endorsedCredentialId: z.string().optional(),
  note: z.string().optional(),
});

export type CreateFollowInput = z.infer<typeof CreateFollowSchema>;

/**
 * Get follow relationship by IDs
 */
export async function getFollow(
  followerId: string,
  followeeId: string
) {
  return prisma.followAndEndorsement.findFirst({
    where: {
      followerId,
      followeeId,
    },
  });
}

/**
 * Create a follow relationship
 */
export async function createFollow(input: CreateFollowInput) {
  // Check if already following
  const existing = await getFollow(input.followerId, input.followeeId);
  if (existing) {
    throw new Error('Already following this user/organization');
  }

  return prisma.followAndEndorsement.create({
    data: {
      followerId: input.followerId,
      followeeId: input.followeeId,
      followeeType: input.followeeType,
      endorsedCredentialId: input.endorsedCredentialId,
      note: input.note,
    },
  });
}

/**
 * Remove a follow relationship
 */
export async function removeFollow(followerId: string, followeeId: string) {
  return prisma.followAndEndorsement.deleteMany({
    where: {
      followerId,
      followeeId,
    },
  });
}

/**
 * Get all users/organizations a user is following
 */
export async function getFollowing(userId: string) {
  return prisma.followAndEndorsement.findMany({
    where: {
      followerId: userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get all followers of a user/organization
 */
export async function getFollowers(followeeId: string) {
  return prisma.followAndEndorsement.findMany({
    where: {
      followeeId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get follow count for a user/organization
 */
export async function getFollowCount(followeeId: string) {
  return prisma.followAndEndorsement.count({
    where: {
      followeeId,
    },
  });
}

/**
 * Get following count for a user
 */
export async function getFollowingCount(followerId: string) {
  return prisma.followAndEndorsement.count({
    where: {
      followerId,
    },
  });
}

/**
 * Get endorsements for a specific credential
 */
export async function getCredentialEndorsements(credentialId: string) {
  return prisma.followAndEndorsement.findMany({
    where: {
      endorsedCredentialId: credentialId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Serialize follow relationship for API response
 */
export function serializeFollow(follow: {
  id: string;
  followerId: string;
  followeeId: string;
  followeeType: string;
  endorsedCredentialId: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: follow.id,
    followerId: follow.followerId,
    followeeId: follow.followeeId,
    followeeType: follow.followeeType,
    endorsedCredentialId: follow.endorsedCredentialId,
    note: follow.note,
    createdAt: follow.createdAt.toISOString(),
    updatedAt: follow.updatedAt.toISOString(),
  };
}

