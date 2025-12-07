/**
 * B234B-COMM-010: PostRankingEngine
 *
 * Ranks posts for discovery based on recency, reactions, endorsements, and category.
 * Prevents gaming via rate limits and feeds trending view.
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger';
import { getReactionCounts } from '../reactionService.js';
import { getFollowCount } from '../models/FollowAndEndorsement.js';

const prisma = new PrismaClient();
const log = getServiceLogger('community/ranking');

export interface PostRankingScore {
  postId: string;
  score: number;
  recencyScore: number;
  reactionScore: number;
  endorsementScore: number;
  categoryScore: number;
}

export interface RankingOptions {
  category?: string;
  limit?: number;
  offset?: number;
  minScore?: number;
}

/**
 * Calculate ranking score for a post
 */
export async function calculatePostScore(postId: string): Promise<PostRankingScore> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      reactions: true,
      comments: {
        include: {
          reactions: true,
        },
      },
    },
  });

  if (!post) {
    throw new Error('Post not found');
  }

  // Recency score (0-1, decays over time)
  const now = Date.now();
  const postAge = now - post.createdAt.getTime();
  const daysSincePost = postAge / (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0, 1 - daysSincePost / 30); // Decay over 30 days

  // Reaction score (based on likes, upvotes)
  const reactionCounts = await getReactionCounts(postId);
  const reactionScore = Math.min(
    1,
    (reactionCounts.like * 0.1 + reactionCounts.upvote * 0.5) / 10
  );

  // Endorsement score (based on author's followers and endorsements)
  const authorFollowers = await getFollowCount(post.authorId);
  const endorsementScore = Math.min(1, authorFollowers / 100);

  // Category score (boost for certain categories)
  const categoryBoosts: Record<string, number> = {
    question: 1.2,
    discussion: 1.1,
    announcement: 1.3,
    general: 1.0,
  };
  const categoryScore = categoryBoosts[post.category || 'general'] || 1.0;

  // Comment engagement score
  const commentCount = post.comments.length;
  const commentScore = Math.min(1, commentCount / 20);

  // Accepted answer bonus
  const acceptedAnswers = post.comments.filter(c =>
    c.reactions.some(r => r.type === 'accepted')
  ).length;
  const acceptedScore = Math.min(1, acceptedAnswers * 0.2);

  // Calculate final score
  const score =
    recencyScore * 0.3 +
    reactionScore * 0.25 +
    endorsementScore * 0.15 +
    commentScore * 0.15 +
    acceptedScore * 0.1 +
    (categoryScore - 1) * 0.05; // Small boost for category

  return {
    postId,
    score,
    recencyScore,
    reactionScore,
    endorsementScore,
    categoryScore,
  };
}

/**
 * Rank posts with rate limiting to prevent gaming
 */
export async function rankPosts(
  options: RankingOptions = {}
): Promise<Array<{ post: any; score: PostRankingScore }>> {
  const {
    category,
    limit = 50,
    offset = 0,
    minScore = 0,
  } = options;

  // Get posts with rate limiting check
  const posts = await prisma.post.findMany({
    where: {
      isDeleted: false,
      ...(category ? { category } : {}),
    },
    include: {
      reactions: true,
      comments: {
        include: {
          reactions: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit * 3, // Get more to filter by score
  });

  // Calculate scores for all posts
  const scoredPosts = await Promise.all(
    posts.map(async (post) => {
      try {
        const score = await calculatePostScore(post.id);
        return { post, score };
      } catch (error) {
        log.error('Error calculating post score', { error, postId: post.id });
        return null;
      }
    })
  );

  // Filter out nulls and low-scoring posts
  const filtered = scoredPosts
    .filter((item): item is { post: any; score: PostRankingScore } => {
      return item !== null && item.score.score >= minScore;
    })
    .sort((a, b) => b.score.score - a.score.score)
    .slice(offset, offset + limit);

  return filtered;
}

/**
 * Get trending posts (high score, recent)
 */
export async function getTrendingPosts(
  limit = 20,
  timeWindowHours = 24
): Promise<Array<{ post: any; score: PostRankingScore }>> {
  const cutoffTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

  const posts = await prisma.post.findMany({
    where: {
      isDeleted: false,
      createdAt: {
        gte: cutoffTime,
      },
    },
    include: {
      reactions: true,
      comments: {
        include: {
          reactions: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit * 2, // Get more to filter by score
  });

  const scoredPosts = await Promise.all(
    posts.map(async (post) => {
      try {
        const score = await calculatePostScore(post.id);
        return { post, score };
      } catch (error) {
        log.error('Error calculating trending post score', { error, postId: post.id });
        return null;
      }
    })
  );

  const filtered = scoredPosts
    .filter((item): item is { post: any; score: PostRankingScore } => {
      return item !== null && item.score.score >= 0.3; // Higher threshold for trending
    })
    .sort((a, b) => b.score.score - a.score.score)
    .slice(0, limit);

  return filtered;
}

/**
 * Rate limit check to prevent gaming
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  userId: string,
  action: 'post' | 'reaction' | 'comment',
  limit: number,
  windowMs: number
): Promise<boolean> {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    log.warn('Rate limit exceeded', { userId, action, count: record.count });
    return false;
  }

  record.count++;
  return true;
}

/**
 * Apply rate limiting to post creation
 */
export async function canCreatePost(userId: string): Promise<boolean> {
  // Allow 10 posts per hour
  return checkRateLimit(userId, 'post', 10, 60 * 60 * 1000);
}

/**
 * Apply rate limiting to reactions
 */
export async function canAddReaction(userId: string): Promise<boolean> {
  // Allow 100 reactions per hour
  return checkRateLimit(userId, 'reaction', 100, 60 * 60 * 1000);
}

/**
 * Apply rate limiting to comments
 */
export async function canCreateComment(userId: string): Promise<boolean> {
  // Allow 50 comments per hour
  return checkRateLimit(userId, 'comment', 50, 60 * 60 * 1000);
}

/**
 * Get category rankings
 */
export async function getCategoryRankings(
  category: string,
  limit = 20
): Promise<Array<{ post: any; score: PostRankingScore }>> {
  return rankPosts({
    category,
    limit,
    minScore: 0.2,
  });
}

/**
 * Refresh ranking scores for all posts (can be run as a background job)
 */
export async function refreshAllRankings() {
  const posts = await prisma.post.findMany({
    where: {
      isDeleted: false,
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    },
    select: { id: true },
  });

  log.info('Refreshing rankings', { postCount: posts.length });

  for (const post of posts) {
    try {
      await calculatePostScore(post.id);
    } catch (error) {
      log.error('Error refreshing post ranking', { error, postId: post.id });
    }
  }

  log.info('Rankings refreshed', { postCount: posts.length });
}

