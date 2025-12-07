/**
 * B250A-DOC-005: DocumentComment Model
 *
 * Model for document comments with threaded comment support
 */

import { PrismaClient } from '@prisma/client';

export interface DocumentCommentInput {
  documentId: string;
  versionId?: string;
  authorId: string;
  comment: string;
  parentCommentId?: string;
}

export interface DocumentComment {
  id: string;
  documentId: string;
  versionId: string | null;
  authorId: string;
  comment: string;
  parentCommentId: string | null;
  createdAt: Date;
}

/**
 * Validate document comment input
 */
export function validateDocumentCommentInput(input: DocumentCommentInput): void {
  if (!input.documentId || input.documentId.trim().length === 0) {
    throw new Error('documentId is required');
  }
  if (!input.authorId || input.authorId.trim().length === 0) {
    throw new Error('authorId is required');
  }
  if (!input.comment || input.comment.trim().length === 0) {
    throw new Error('comment is required');
  }
}

/**
 * Create document comment
 */
export async function createDocumentComment(
  prisma: PrismaClient,
  input: DocumentCommentInput
): Promise<DocumentComment> {
  validateDocumentCommentInput(input);

  // Verify document exists
  const document = await prisma.document.findUnique({
    where: { id: input.documentId },
  });

  if (!document) {
    throw new Error(`Document with id "${input.documentId}" not found`);
  }

  // If versionId is provided, verify it exists and belongs to document
  if (input.versionId) {
    const version = await prisma.documentVersion.findFirst({
      where: {
        id: input.versionId,
        documentId: input.documentId,
      },
    });

    if (!version) {
      throw new Error(`Version ${input.versionId} not found for document ${input.documentId}`);
    }
  }

  // If parentCommentId is provided, verify it exists and belongs to same document
  if (input.parentCommentId) {
    const parent = await prisma.documentComment.findFirst({
      where: {
        id: input.parentCommentId,
        documentId: input.documentId,
      },
    });

    if (!parent) {
      throw new Error(`Parent comment ${input.parentCommentId} not found for document ${input.documentId}`);
    }
  }

  return prisma.documentComment.create({
    data: {
      documentId: input.documentId,
      versionId: input.versionId ?? null,
      authorId: input.authorId,
      comment: input.comment,
      parentCommentId: input.parentCommentId ?? null,
    },
  });
}

/**
 * Get document comment by ID
 */
export async function getDocumentCommentById(
  prisma: PrismaClient,
  id: string
): Promise<DocumentComment | null> {
  return prisma.documentComment.findUnique({
    where: { id },
  });
}

/**
 * Get all comments for a document
 */
export async function getDocumentComments(
  prisma: PrismaClient,
  documentId: string,
  filters?: {
    versionId?: string;
    parentCommentId?: string | null; // null for top-level comments only
  }
): Promise<DocumentComment[]> {
  const where: any = { documentId };
  if (filters?.versionId) {
    where.versionId = filters.versionId;
  }
  if (filters?.parentCommentId !== undefined) {
    where.parentCommentId = filters.parentCommentId;
  }

  return prisma.documentComment.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get comment thread (comment and all replies)
 */
export async function getCommentThread(
  prisma: PrismaClient,
  commentId: string
): Promise<DocumentComment[]> {
  const comment = await prisma.documentComment.findUnique({
    where: { id: commentId },
  });

  if (!comment) {
    return [];
  }

  // Get all replies recursively
  const thread: DocumentComment[] = [comment];
  const replies = await getReplies(prisma, commentId);
  thread.push(...replies);

  return thread;
}

/**
 * Get direct replies to a comment
 */
async function getReplies(
  prisma: PrismaClient,
  parentCommentId: string
): Promise<DocumentComment[]> {
  const replies = await prisma.documentComment.findMany({
    where: { parentCommentId },
    orderBy: { createdAt: 'asc' },
  });

  // Recursively get replies to replies
  const allReplies: DocumentComment[] = [...replies];
  for (const reply of replies) {
    const nestedReplies = await getReplies(prisma, reply.id);
    allReplies.push(...nestedReplies);
  }

  return allReplies;
}

/**
 * Update document comment
 */
export async function updateDocumentComment(
  prisma: PrismaClient,
  id: string,
  comment: string
): Promise<DocumentComment> {
  if (!comment || comment.trim().length === 0) {
    throw new Error('comment is required');
  }

  return prisma.documentComment.update({
    where: { id },
    data: { comment },
  });
}

/**
 * Delete document comment
 */
export async function deleteDocumentComment(
  prisma: PrismaClient,
  id: string
): Promise<DocumentComment> {
  // Check if comment has replies
  const replies = await prisma.documentComment.findMany({
    where: { parentCommentId: id },
  });

  if (replies.length > 0) {
    // Optionally delete replies as well, or just the comment
    // For now, we'll delete the comment and leave replies orphaned
    // (they can be cleaned up separately if needed)
  }

  return prisma.documentComment.delete({
    where: { id },
  });
}

/**
 * Get top-level comments for a document (no parent)
 */
export async function getTopLevelComments(
  prisma: PrismaClient,
  documentId: string,
  versionId?: string
): Promise<DocumentComment[]> {
  const where: any = {
    documentId,
    parentCommentId: null,
  };
  if (versionId) {
    where.versionId = versionId;
  }

  return prisma.documentComment.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });
}

