/**
 * B250B-DOC-019: DocumentNotificationService
 * Sends notifications on publish/update/comment events to subscribers
 * Uses existing Notification system
 * Template-based messages
 */

import { PrismaClient } from '@prisma/client';
import { createNotification } from '../../notifications/notificationService.js';

const prisma = new PrismaClient();

export interface NotificationTemplate {
  type: string;
  subject: string;
  message: (params: any) => string;
}

const templates: Record<string, NotificationTemplate> = {
  DOCUMENT_PUBLISHED: {
    type: 'DOCUMENT_PUBLISHED',
    subject: 'Document Published',
    message: (params: { documentTitle: string; authorName: string }) =>
      `Document "${params.documentTitle}" has been published by ${params.authorName}.`,
  },
  DOCUMENT_UPDATED: {
    type: 'DOCUMENT_UPDATED',
    subject: 'Document Updated',
    message: (params: { documentTitle: string; updaterName: string }) =>
      `Document "${params.documentTitle}" has been updated by ${params.updaterName}.`,
  },
  DOCUMENT_ARCHIVED: {
    type: 'DOCUMENT_ARCHIVED',
    subject: 'Document Archived',
    message: (params: { documentTitle: string; archiverName: string }) =>
      `Document "${params.documentTitle}" has been archived by ${params.archiverName}.`,
  },
  DOCUMENT_COMMENT: {
    type: 'DOCUMENT_COMMENT',
    subject: 'New Comment on Document',
    message: (params: { documentTitle: string; commentAuthorName: string }) =>
      `${params.commentAuthorName} commented on "${params.documentTitle}".`,
  },
  COMMENT_REPLY: {
    type: 'COMMENT_REPLY',
    subject: 'Reply to Your Comment',
    message: (params: { documentTitle: string; replyAuthorName: string }) =>
      `${params.replyAuthorName} replied to your comment on "${params.documentTitle}".`,
  },
};

export class DocumentNotificationService {
  /**
   * Notify subscribers when document is published
   */
  async notifyPublished(documentId: string, publishedById: string) {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        access: {
          where: {
            revokedAt: null,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Get publisher info
    const publisher = await prisma.user.findUnique({
      where: { id: publishedById },
      select: { name: true },
    });

    // Notify document author (if not the publisher)
    if (document.authorId !== publishedById) {
      await createNotification({
        userId: document.authorId,
        type: templates.DOCUMENT_PUBLISHED.type,
        payload: {
          documentId,
          documentTitle: document.title,
          authorName: publisher?.name || 'Unknown',
        },
      });
    }

    // Notify users with access
    const userIds = document.access
      .map((a) => a.userId)
      .filter((id): id is string => !!id && id !== publishedById && id !== document.authorId);

    for (const userId of userIds) {
      await createNotification({
        userId,
        type: templates.DOCUMENT_PUBLISHED.type,
        payload: {
          documentId,
          documentTitle: document.title,
          authorName: publisher?.name || 'Unknown',
        },
      });
    }
  }

  /**
   * Notify subscribers when document is updated
   */
  async notifyUpdated(documentId: string, updatedById: string) {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        author: {
          select: {
            id: true,
          },
        },
        access: {
          where: {
            revokedAt: null,
          },
          include: {
            user: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Get updater info
    const updater = await prisma.user.findUnique({
      where: { id: updatedById },
      select: { name: true },
    });

    // Notify document author (if not the updater)
    if (document.authorId !== updatedById) {
      await createNotification({
        userId: document.authorId,
        type: templates.DOCUMENT_UPDATED.type,
        payload: {
          documentId,
          documentTitle: document.title,
          updaterName: updater?.name || 'Unknown',
        },
      });
    }

    // Notify users with access
    const userIds = document.access
      .map((a) => a.userId)
      .filter((id): id is string => !!id && id !== updatedById && id !== document.authorId);

    for (const userId of userIds) {
      await createNotification({
        userId,
        type: templates.DOCUMENT_UPDATED.type,
        payload: {
          documentId,
          documentTitle: document.title,
          updaterName: updater?.name || 'Unknown',
        },
      });
    }
  }

  /**
   * Notify subscribers when document is archived
   */
  async notifyArchived(documentId: string, archivedById: string) {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        author: {
          select: {
            id: true,
          },
        },
        access: {
          where: {
            revokedAt: null,
          },
          include: {
            user: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Get archiver info
    const archiver = await prisma.user.findUnique({
      where: { id: archivedById },
      select: { name: true },
    });

    // Notify document author (if not the archiver)
    if (document.authorId !== archivedById) {
      await createNotification({
        userId: document.authorId,
        type: templates.DOCUMENT_ARCHIVED.type,
        payload: {
          documentId,
          documentTitle: document.title,
          archiverName: archiver?.name || 'Unknown',
        },
      });
    }

    // Notify users with access
    const userIds = document.access
      .map((a) => a.userId)
      .filter((id): id is string => !!id && id !== archivedById && id !== document.authorId);

    for (const userId of userIds) {
      await createNotification({
        userId,
        type: templates.DOCUMENT_ARCHIVED.type,
        payload: {
          documentId,
          documentTitle: document.title,
          archiverName: archiver?.name || 'Unknown',
        },
      });
    }
  }
}

export const documentNotificationService = new DocumentNotificationService();

