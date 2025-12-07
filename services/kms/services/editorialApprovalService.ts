/**
 * B243B-KMS-014: EditorialApprovalService
 *
 * Handles review/approval workflow: reviewers can request changes, approve, or reject drafts.
 * Logs decisions and comments; notifications sent via NotificationService.
 */

import { PrismaClient, ApprovalDecision } from '@prisma/client';
import { createNotification } from '../../notifications/notificationService.js';
import { getServiceLogger } from '../../logging/serviceLogger.js';

const log = getServiceLogger('kms/editorial-approval');

export interface ApprovalInput {
  articleId: string;
  reviewerId: string;
  decision: ApprovalDecision;
  comments?: string;
}

export interface ApprovalRecord {
  id: string;
  articleId: string;
  reviewerId: string;
  decision: ApprovalDecision;
  comments: string | null;
  createdAt: Date;
}

/**
 * Submit an approval decision for an article
 */
export async function submitApproval(
  prisma: PrismaClient,
  input: ApprovalInput
): Promise<ApprovalRecord> {
  // Validate article exists
  const article = await prisma.contentArticle.findUnique({
    where: { id: input.articleId },
    include: { author: true },
  });

  if (!article) {
    throw new Error(`Article ${input.articleId} not found`);
  }

  // Validate reviewer exists
  const reviewer = await prisma.user.findUnique({
    where: { id: input.reviewerId },
  });

  if (!reviewer) {
    throw new Error(`Reviewer ${input.reviewerId} not found`);
  }

  // Create approval record
  const approval = await prisma.editorialApproval.create({
    data: {
      articleId: input.articleId,
      reviewerId: input.reviewerId,
      decision: input.decision,
      comments: input.comments || null,
    },
  });

  // Update article status based on decision
  let newStatus: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED' = article.status;
  if (input.decision === 'APPROVED') {
    newStatus = 'PUBLISHED';
    // Set publish date if not already set
    if (!article.publishDate) {
      await prisma.contentArticle.update({
        where: { id: input.articleId },
        data: { publishDate: new Date() },
      });
    }
  } else if (input.decision === 'CHANGES_REQUESTED') {
    newStatus = 'DRAFT';
  } else if (input.decision === 'REJECTED') {
    newStatus = 'DRAFT';
  }

  await prisma.contentArticle.update({
    where: { id: input.articleId },
    data: { status: newStatus },
  });

  // Send notification to author
  try {
    if (article.author.userId) {
      await createNotification(
        article.author.userId,
        'ARTICLE_REVIEW_DECISION',
        {
          articleId: input.articleId,
          articleTitle: article.title,
          decision: input.decision,
          reviewerName: reviewer.name,
          comments: input.comments,
        }
      );
    }
  } catch (error) {
    log.warn('Failed to send approval notification', { error, articleId: input.articleId });
  }

  log.info('Approval decision submitted', {
    articleId: input.articleId,
    reviewerId: input.reviewerId,
    decision: input.decision,
  });

  return approval;
}

/**
 * Get approval history for an article
 */
export async function getApprovalHistory(
  prisma: PrismaClient,
  articleId: string
): Promise<ApprovalRecord[]> {
  return prisma.editorialApproval.findMany({
    where: { articleId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get pending approvals for a reviewer
 */
export async function getPendingApprovals(
  prisma: PrismaClient,
  reviewerId: string
): Promise<Array<ApprovalRecord & { article: { id: string; title: string; author: { name: string } } }>> {
  // Get articles in REVIEW status that haven't been reviewed by this reviewer
  const reviewedArticleIds = await prisma.editorialApproval.findMany({
    where: { reviewerId },
    select: { articleId: true },
    distinct: ['articleId'],
  });

  const reviewedIds = reviewedArticleIds.map((a) => a.articleId);

  const articles = await prisma.contentArticle.findMany({
    where: {
      status: 'REVIEW',
      id: {
        notIn: reviewedIds.length > 0 ? reviewedIds : [],
      },
    },
    include: {
      author: true,
    },
  });

  // Return as pending approvals (not yet created in EditorialApproval table)
  return articles.map((article) => ({
    id: '', // Not yet created
    articleId: article.id,
    reviewerId,
    decision: 'CHANGES_REQUESTED' as ApprovalDecision, // Placeholder
    comments: null,
    createdAt: article.createdAt,
    article: {
      id: article.id,
      title: article.title,
      author: {
        name: article.author.name,
      },
    },
  }));
}

/**
 * Request review for an article
 */
export async function requestReview(
  prisma: PrismaClient,
  articleId: string,
  authorId: string
): Promise<boolean> {
  const article = await prisma.contentArticle.findUnique({
    where: { id: articleId },
    include: { author: true },
  });

  if (!article) {
    throw new Error(`Article ${articleId} not found`);
  }

  if (article.authorId !== authorId) {
    throw new Error('Only the author can request review');
  }

  if (article.status !== 'DRAFT') {
    throw new Error('Only draft articles can be submitted for review');
  }

  // Update status to REVIEW
  await prisma.contentArticle.update({
    where: { id: articleId },
    data: { status: 'REVIEW' },
  });

  // Notify reviewers (this would typically notify a list of reviewers)
  log.info('Review requested', { articleId, authorId });

  return true;
}

