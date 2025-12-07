/**
 * B250A-DOC-009: DocumentSearchIndex Model
 *
 * Model for storing indexable text content for search functionality
 */

import { PrismaClient } from '@prisma/client';

export interface DocumentSearchIndexInput {
  documentId: string;
  versionId: string;
  content: string;
  tags?: string;
  category?: string;
}

export interface DocumentSearchIndex {
  id: string;
  documentId: string;
  versionId: string;
  content: string;
  tags: string | null;
  category: string | null;
  createdAt: Date;
}

/**
 * Validate document search index input
 */
export function validateDocumentSearchIndexInput(input: DocumentSearchIndexInput): void {
  if (!input.documentId || input.documentId.trim().length === 0) {
    throw new Error('documentId is required');
  }
  if (!input.versionId || input.versionId.trim().length === 0) {
    throw new Error('versionId is required');
  }
  if (!input.content || input.content.trim().length === 0) {
    throw new Error('content is required');
  }
}

/**
 * Create or update document search index entry
 */
export async function upsertDocumentSearchIndex(
  prisma: PrismaClient,
  input: DocumentSearchIndexInput
): Promise<DocumentSearchIndex> {
  validateDocumentSearchIndexInput(input);

  // Verify document exists
  const document = await prisma.document.findUnique({
    where: { id: input.documentId },
  });

  if (!document) {
    throw new Error(`Document with id "${input.documentId}" not found`);
  }

  // Verify version exists and belongs to document
  const version = await prisma.documentVersion.findFirst({
    where: {
      id: input.versionId,
      documentId: input.documentId,
    },
  });

  if (!version) {
    throw new Error(`Version ${input.versionId} not found for document ${input.documentId}`);
  }

  // Check if index entry already exists for this version
  const existing = await prisma.documentSearchIndex.findFirst({
    where: {
      documentId: input.documentId,
      versionId: input.versionId,
    },
  });

  if (existing) {
    // Update existing entry
    return prisma.documentSearchIndex.update({
      where: { id: existing.id },
      data: {
        content: input.content,
        tags: input.tags ?? null,
        category: input.category ?? null,
      },
    });
  }

  // Create new entry
  return prisma.documentSearchIndex.create({
    data: {
      documentId: input.documentId,
      versionId: input.versionId,
      content: input.content,
      tags: input.tags ?? null,
      category: input.category ?? null,
    },
  });
}

/**
 * Get document search index by ID
 */
export async function getDocumentSearchIndexById(
  prisma: PrismaClient,
  id: string
): Promise<DocumentSearchIndex | null> {
  return prisma.documentSearchIndex.findUnique({
    where: { id },
  });
}

/**
 * Get search index for a document
 */
export async function getDocumentSearchIndex(
  prisma: PrismaClient,
  documentId: string
): Promise<DocumentSearchIndex | null> {
  // Get the current version's index
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { currentVersionId: true },
  });

  if (!document || !document.currentVersionId) {
    return null;
  }

  return prisma.documentSearchIndex.findFirst({
    where: {
      documentId,
      versionId: document.currentVersionId,
    },
  });
}

/**
 * Get search index for a specific version
 */
export async function getVersionSearchIndex(
  prisma: PrismaClient,
  documentId: string,
  versionId: string
): Promise<DocumentSearchIndex | null> {
  return prisma.documentSearchIndex.findFirst({
    where: {
      documentId,
      versionId,
    },
  });
}

/**
 * Search documents by content
 */
export async function searchDocuments(
  prisma: PrismaClient,
  query: string,
  filters?: {
    tags?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }
): Promise<DocumentSearchIndex[]> {
  const where: any = {
    content: {
      contains: query,
      mode: 'insensitive',
    },
  };

  if (filters?.tags) {
    where.tags = {
      contains: filters.tags,
      mode: 'insensitive',
    };
  }

  if (filters?.category) {
    where.category = {
      contains: filters.category,
      mode: 'insensitive',
    };
  }

  return prisma.documentSearchIndex.findMany({
    where,
    take: filters?.limit ?? 100,
    skip: filters?.offset ?? 0,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Delete document search index
 */
export async function deleteDocumentSearchIndex(
  prisma: PrismaClient,
  id: string
): Promise<DocumentSearchIndex> {
  return prisma.documentSearchIndex.delete({
    where: { id },
  });
}

/**
 * Delete search index for a document version
 */
export async function deleteVersionSearchIndex(
  prisma: PrismaClient,
  documentId: string,
  versionId: string
): Promise<void> {
  await prisma.documentSearchIndex.deleteMany({
    where: {
      documentId,
      versionId,
    },
  });
}

