/**
 * B234B-COMM-007: SocialGraphService
 *
 * Manages follow relationships and endorsements.
 * Suggests people to follow based on specialty and interactions.
 * Prevents duplications and returns counts and lists.
 */

import { PrismaClient } from '@prisma/client';
import {
  createFollow,
  getFollow,
  removeFollow,
  getFollowing,
  getFollowers,
  getFollowCount,
  getFollowingCount,
  getCredentialEndorsements,
  CreateFollowInput,
} from './models/FollowAndEndorsement.js';
import { getServiceLogger } from '../logging/serviceLogger';

const prisma = new PrismaClient();
const log = getServiceLogger('community/socialGraph');

/**
 * Follow a user or organization
 */
export async function followUserOrOrg(input: CreateFollowInput) {
  try {
    // Prevent self-follow
    if (input.followerId === input.followeeId) {
      throw new Error('Cannot follow yourself');
    }

    const follow = await createFollow(input);
    log.info('User followed', {
      followerId: input.followerId,
      followeeId: input.followeeId,
      followeeType: input.followeeType,
    });
    return follow;
  } catch (error: any) {
    if (error.message === 'Already following this user/organization') {
      throw error;
    }
    log.error('Error following user', { error, input });
    throw error;
  }
}

/**
 * Unfollow a user or organization
 */
export async function unfollowUserOrOrg(followerId: string, followeeId: string) {
  const result = await removeFollow(followerId, followeeId);
  log.info('User unfollowed', { followerId, followeeId });
  return result;
}

/**
 * Check if user A is following user B
 */
export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const follow = await getFollow(followerId, followeeId);
  return follow !== null;
}

/**
 * Get follow statistics for a user/organization
 */
export async function getFollowStats(entityId: string) {
  const [followers, following] = await Promise.all([
    getFollowCount(entityId),
    getFollowingCount(entityId),
  ]);

  return {
    followers,
    following,
  };
}

/**
 * Get list of users/organizations a user is following
 */
export async function getFollowingList(userId: string, limit = 50, offset = 0) {
  const follows = await getFollowing(userId);
  return follows.slice(offset, offset + limit);
}

/**
 * Get list of followers for a user/organization
 */
export async function getFollowersList(followeeId: string, limit = 50, offset = 0) {
  const followers = await getFollowers(followeeId);
  return followers.slice(offset, offset + limit);
}

/**
 * Endorse a specific credential
 */
export async function endorseCredential(
  followerId: string,
  followeeId: string,
  credentialId: string,
  note?: string
) {
  // Check if already following
  const existing = await getFollow(followerId, followeeId);

  if (existing) {
    // Update existing follow with endorsement
    return prisma.followAndEndorsement.update({
      where: {
        id: existing.id,
      },
      data: {
        endorsedCredentialId: credentialId,
        note: note || existing.note,
      },
    });
  } else {
    // Create new follow with endorsement
    return createFollow({
      followerId,
      followeeId,
      followeeType: 'user',
      endorsedCredentialId: credentialId,
      note,
    });
  }
}

/**
 * Get suggestions for people to follow based on specialty and interactions
 */
export async function getFollowSuggestions(
  userId: string,
  limit = 10
): Promise<Array<{ id: string; type: string; reason: string; score: number }>> {
  // Get user's current following list
  const currentFollowing = await getFollowing(userId);
  const followingIds = new Set(currentFollowing.map(f => f.followeeId));

  // Get user's specialty from their credentials or profile
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      credentials: true,
      npiClaims: {
        include: {
          user: true,
        },
      },
    },
  });

  const suggestions: Array<{ id: string; type: string; reason: string; score: number }> = [];

  // Strategy 1: Suggest users with similar specialties
  if (user?.npiClaims && user.npiClaims.length > 0) {
    const userTags = user.npiClaims[0].tags as any;
    const specialty = userTags?.specialty?.[0];

    if (specialty) {
      // Find other users with same specialty
      // Note: Prisma JSON filtering is limited, so we fetch and filter in memory
      const allClaims = await prisma.npiClaim.findMany({
        where: {
          userId: {
            not: userId,
            notIn: Array.from(followingIds),
          },
        },
        take: limit * 10, // Get more to filter
        include: {
          user: true,
        },
      });

      // Filter by specialty in memory
      const similarUsers = allClaims.filter(claim => {
        const tags = claim.tags as any;
        const specialties = Array.isArray(tags?.specialty) ? tags.specialty : [];
        return specialties.includes(specialty);
      }).slice(0, limit * 2);

      for (const claim of similarUsers) {
        if (!followingIds.has(claim.userId)) {
          suggestions.push({
            id: claim.userId,
            type: 'user',
            reason: `Same specialty: ${specialty}`,
            score: 0.8,
          });
          followingIds.add(claim.userId);
        }
      }
    }
  }

  // Strategy 2: Suggest users who follow the same people (mutual connections)
  const mutualConnections = await prisma.followAndEndorsement.findMany({
    where: {
      followeeId: {
        in: currentFollowing.map(f => f.followeeId),
      },
      followerId: {
        not: userId,
        notIn: Array.from(followingIds),
      },
    },
    take: limit * 2,
  });

  const mutualCounts = new Map<string, number>();
  for (const conn of mutualConnections) {
    const count = mutualCounts.get(conn.followerId) || 0;
    mutualCounts.set(conn.followerId, count + 1);
  }

  for (const [followerId, count] of mutualCounts.entries()) {
    if (!followingIds.has(followerId) && suggestions.length < limit) {
      suggestions.push({
        id: followerId,
        type: 'user',
        reason: `${count} mutual connection${count > 1 ? 's' : ''}`,
        score: Math.min(0.7, count * 0.1),
      });
      followingIds.add(followerId);
    }
  }

  // Strategy 3: Suggest popular users (most followers)
  const popularUsers = await prisma.followAndEndorsement.groupBy({
    by: ['followeeId'],
    _count: {
      followeeId: true,
    },
    where: {
      followeeId: {
        notIn: Array.from(followingIds),
      },
    },
    orderBy: {
      _count: {
        followeeId: 'desc',
      },
    },
    take: limit,
  });

  for (const popular of popularUsers) {
    if (!followingIds.has(popular.followeeId) && suggestions.length < limit) {
      suggestions.push({
        id: popular.followeeId,
        type: 'user',
        reason: `Popular user with ${popular._count.followeeId} followers`,
        score: 0.6,
      });
      followingIds.add(popular.followeeId);
    }
  }

  // Sort by score and return top suggestions
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Get mutual followers between two users
 */
export async function getMutualFollowers(userId1: string, userId2: string) {
  const [followers1, followers2] = await Promise.all([
    getFollowers(userId1),
    getFollowers(userId2),
  ]);

  const followers1Set = new Set(followers1.map(f => f.followerId));
  const mutual = followers2.filter(f => followers1Set.has(f.followerId));

  return mutual;
}

