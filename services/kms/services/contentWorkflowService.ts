/**
 * B243A-KMS-006: ContentWorkflowService
 *
 * Manages article state transitions: draft → review → published → archived
 * Ensures only authorised roles can approve publishing
 * Logs state changes
 */

import { PrismaClient, ContentArticleStatus } from '@prisma/client';
import { ContentArticleService } from '../models/ContentArticle';

export interface WorkflowTransition {
  from: ContentArticleStatus;
  to: ContentArticleStatus;
  allowedRoles: string[];
}

export interface StateChangeLog {
  articleId: string;
  fromStatus: ContentArticleStatus;
  toStatus: ContentArticleStatus;
  userId: string;
  timestamp: Date;
  reason?: string;
}

/**
 * ContentWorkflowService
 *
 * Manages article state transitions with role-based authorization
 */
export class ContentWorkflowService {
  private articleService: ContentArticleService;
  private stateChangeLogs: StateChangeLog[] = []; // In-memory log (could be persisted to DB)

  // Define allowed transitions and required roles
  private transitions: WorkflowTransition[] = [
    {
      from: ContentArticleStatus.DRAFT,
      to: ContentArticleStatus.REVIEW,
      allowedRoles: ['editor', 'admin', 'author'],
    },
    {
      from: ContentArticleStatus.REVIEW,
      to: ContentArticleStatus.PUBLISHED,
      allowedRoles: ['admin', 'publisher'],
    },
    {
      from: ContentArticleStatus.REVIEW,
      to: ContentArticleStatus.DRAFT,
      allowedRoles: ['editor', 'admin'],
    },
    {
      from: ContentArticleStatus.PUBLISHED,
      to: ContentArticleStatus.ARCHIVED,
      allowedRoles: ['admin', 'publisher'],
    },
    {
      from: ContentArticleStatus.ARCHIVED,
      to: ContentArticleStatus.DRAFT,
      allowedRoles: ['admin'],
    },
  ];

  constructor(private prisma: PrismaClient) {
    this.articleService = new ContentArticleService(prisma);
  }

  /**
   * Transition article to a new status
   */
  async transitionArticle(
    articleId: string,
    newStatus: ContentArticleStatus,
    userId: string,
    userRoles: string[],
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    const article = await this.articleService.getArticleById(articleId);
    if (!article) {
      return { success: false, message: 'Article not found' };
    }

    // Check if transition is allowed
    const transition = this.transitions.find(
      (t) => t.from === article.status && t.to === newStatus
    );

    if (!transition) {
      return {
        success: false,
        message: `Transition from ${article.status} to ${newStatus} is not allowed`,
      };
    }

    // Check if user has required role
    const hasRequiredRole = transition.allowedRoles.some((role) => userRoles.includes(role));
    if (!hasRequiredRole) {
      return {
        success: false,
        message: `User does not have required role. Required: ${transition.allowedRoles.join(', ')}`,
      };
    }

    // Perform transition
    const oldStatus = article.status;
    await this.articleService.updateArticle(articleId, { status: newStatus });

    // Log state change
    this.logStateChange({
      articleId,
      fromStatus: oldStatus,
      toStatus: newStatus,
      userId,
      timestamp: new Date(),
      reason,
    });

    // If publishing, set publish date
    if (newStatus === ContentArticleStatus.PUBLISHED && !article.publishDate) {
      await this.articleService.updateArticle(articleId, {
        publishDate: new Date(),
      });
    }

    return {
      success: true,
      message: `Article transitioned from ${oldStatus} to ${newStatus}`,
    };
  }

  /**
   * Submit article for review
   */
  async submitForReview(
    articleId: string,
    userId: string,
    userRoles: string[]
  ): Promise<{ success: boolean; message: string }> {
    return this.transitionArticle(
      articleId,
      ContentArticleStatus.REVIEW,
      userId,
      userRoles,
      'Submitted for review'
    );
  }

  /**
   * Approve and publish article
   */
  async approveAndPublish(
    articleId: string,
    userId: string,
    userRoles: string[]
  ): Promise<{ success: boolean; message: string }> {
    return this.transitionArticle(
      articleId,
      ContentArticleStatus.PUBLISHED,
      userId,
      userRoles,
      'Approved and published'
    );
  }

  /**
   * Reject article (send back to draft)
   */
  async rejectArticle(
    articleId: string,
    userId: string,
    userRoles: string[],
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    return this.transitionArticle(
      articleId,
      ContentArticleStatus.DRAFT,
      userId,
      userRoles,
      `Rejected: ${reason}`
    );
  }

  /**
   * Archive article
   */
  async archiveArticle(
    articleId: string,
    userId: string,
    userRoles: string[]
  ): Promise<{ success: boolean; message: string }> {
    return this.transitionArticle(
      articleId,
      ContentArticleStatus.ARCHIVED,
      userId,
      userRoles,
      'Archived'
    );
  }

  /**
   * Get state change history for an article
   */
  getStateChangeHistory(articleId: string): StateChangeLog[] {
    return this.stateChangeLogs.filter((log) => log.articleId === articleId);
  }

  /**
   * Get all state change logs
   */
  getAllStateChangeLogs(): StateChangeLog[] {
    return [...this.stateChangeLogs];
  }

  /**
   * Get available transitions for an article
   */
  async getAvailableTransitions(
    articleId: string,
    userRoles: string[]
  ): Promise<ContentArticleStatus[]> {
    const article = await this.articleService.getArticleById(articleId);
    if (!article) {
      return [];
    }

    const available = this.transitions
      .filter((t) => t.from === article.status)
      .filter((t) => t.allowedRoles.some((role) => userRoles.includes(role)))
      .map((t) => t.to);

    return [...new Set(available)]; // Remove duplicates
  }

  private logStateChange(log: StateChangeLog): void {
    this.stateChangeLogs.push(log);
    // In production, persist to database
    // await this.prisma.stateChangeLog.create({ data: log });
  }
}

