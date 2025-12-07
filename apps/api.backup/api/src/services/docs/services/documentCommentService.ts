/**
 * B250B-DOC-013: DocumentCommentService
 * Create/edit/delete comments; supports threaded replies
 * Enforces permission checks; triggers notifications to document authors
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { createNotification } from '../../notifications/notificationService.js';

const prisma = new PrismaClient();

const CreateCommentSchema = z.object({
  documentId: z.string(),
  parentId: z.string().optional(),
  content: z.string().min(1).max(5000),
  authorId: z.string(),
});

const UpdateCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

export interface CreateCommentParams {
  documentId: string;
  parentId?: string;
  content: string;
  authorId: string;
}

export interface UpdateCommentParams {
  commentId: string;
  content: string;
  userId: string;
}

export interface DeleteCommentParams {
  commentId: string;
  userId: string;
}

export class DocumentCommentService {
  /**
   * Create a new comment
   */
  async createComment(params: CreateCommentParams) {
    // Validate input
    const validated = CreateCommentSchema.parse(params);

    // Verify document exists
    const document = await prisma.document.findUnique({
      where: { id: validated.documentId },
      select: { id: true, authorId: true, title: true },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // If parentId provided, verify parent comment exists
    if (validated.parentId) {
      const parent = await prisma.documentComment.findUnique({
        where: { id: validated.parentId },
      });

      if (!parent || parent.documentId !== validated.documentId) {
        throw new Error('Parent comment not found or belongs to different document');
      }
    }

    // Create comment
    const comment = await prisma.documentComment.create({
      data: {
        documentId: validated.documentId,
        parentId: validated.parentId,
        content: validated.content,
        authorId: validated.authorId,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // Send notification to document author (if not the commenter)
    if (document.authorId !== validated.authorId) {
      await createNotification({
        userId: document.authorId,
        type: 'DOCUMENT_COMMENT',
        payload: {
          documentId: validated.documentId,
          documentTitle: document.title,
          commentId: comment.id,
          commentAuthorId: validated.authorId,
          isReply: !!validated.parentId,
        },
      });
    }

    // If this is a reply, also notify the parent comment author
    if (validated.parentId) {
      const parent = await prisma.documentComment.findUnique({
        where: { id: validated.parentId },
        select: { authorId: true },
      });

      if (parent && parent.authorId !== validated.authorId && parent.authorId !== document.authorId) {
        await createNotification({
          userId: parent.authorId,
          type: 'COMMENT_REPLY',
          payload: {
            documentId: validated.documentId,
            documentTitle: document.title,
            commentId: comment.id,
            parentCommentId: validated.parentId,
            replyAuthorId: validated.authorId,
          },
        });
      }
    }

    return comment;
  }

  /**
   * Update a comment
   */
  async updateComment(params: UpdateCommentParams) {
    // Validate input
    const validated = UpdateCommentSchema.parse({ content: params.content });

    // Get comment
    const comment = await prisma.documentComment.findUnique({
      where: { id: params.commentId },
    });

    if (!comment) {
      throw new Error('Comment not found');
    }

    // Check permissions - only author can update
    if (comment.authorId !== params.userId) {
      throw new Error('Insufficient permissions to update comment');
    }

    // Check if already deleted
    if (comment.deletedAt) {
      throw new Error('Cannot update deleted comment');
    }

    // Update comment
    return prisma.documentComment.update({
      where: { id: params.commentId },
      data: {
        content: validated.content,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Delete a comment (soft delete)
   */
  async deleteComment(params: DeleteCommentParams) {
    // Get comment
    const comment = await prisma.documentComment.findUnique({
      where: { id: params.commentId },
    });

    if (!comment) {
      throw new Error('Comment not found');
    }

    // Check permissions - only author can delete
    if (comment.authorId !== params.userId) {
      throw new Error('Insufficient permissions to delete comment');
    }

    // Soft delete
    return prisma.documentComment.update({
      where: { id: params.commentId },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Get comments for a document (with threading)
   */
  async getComments(documentId: string) {
    const comments = await prisma.documentComment.findMany({
      where: {
        documentId,
        deletedAt: null,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        replies: {
          where: {
            deletedAt: null,
          },
          include: {
            author: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Filter to only top-level comments (no parent)
    return comments.filter((comment) => !comment.parentId);
  }
}

export const documentCommentService = new DocumentCommentService();

