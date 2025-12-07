/**
 * B250A-DOC-001: Document Model
 *
 * Model for documents with all required fields including status, versioning, and categorization
 */

import { PrismaClient } from '@prisma/client';

export enum DocumentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export interface DocumentInput {
  title: string;
  slug: string;
  description?: string;
  categoryId?: string;
  authorId: string;
  tags?: string[];
  status?: DocumentStatus;
}

export interface Document {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  categoryId: string | null;
  currentVersionId: string | null;
  status: DocumentStatus;
  authorId: string;
  tags: string[];
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate document input
 */
export function validateDocumentInput(input: DocumentInput): void {
  if (!input.title || input.title.trim().length === 0) {
    throw new Error('title is required');
  }
  if (!input.slug || input.slug.trim().length === 0) {
    throw new Error('slug is required');
  }
  if (!input.authorId || input.authorId.trim().length === 0) {
    throw new Error('authorId is required');
  }
  // Validate slug format (alphanumeric, hyphens, underscores)
  if (!/^[a-z0-9_-]+$/.test(input.slug)) {
    throw new Error('slug must contain only lowercase letters, numbers, hyphens, and underscores');
  }
  if (input.tags && !Array.isArray(input.tags)) {
    throw new Error('tags must be an array');
  }
  if (input.status && !Object.values(DocumentStatus).includes(input.status)) {
    throw new Error(`status must be one of: ${Object.values(DocumentStatus).join(', ')}`);
  }
}

/**
 * Create document
 */
export async function createDocument(
  prisma: PrismaClient,
  input: DocumentInput
): Promise<Document> {
  validateDocumentInput(input);

  // Check if slug already exists
  const existing = await prisma.document.findUnique({
    where: { slug: input.slug },
  });

  if (existing) {
    throw new Error(`Document with slug "${input.slug}" already exists`);
  }

  return prisma.document.create({
    data: {
      title: input.title,
      slug: input.slug,
      description: input.description ?? null,
      categoryId: input.categoryId ?? null,
      authorId: input.authorId,
      tags: input.tags ?? [],
      status: input.status || DocumentStatus.DRAFT,
      publishedAt: input.status === DocumentStatus.PUBLISHED ? new Date() : null,
    },
  });
}

/**
 * Get document by ID
 */
export async function getDocumentById(
  prisma: PrismaClient,
  id: string
): Promise<Document | null> {
  return prisma.document.findUnique({
    where: { id },
  });
}

/**
 * Get document by slug
 */
export async function getDocumentBySlug(
  prisma: PrismaClient,
  slug: string
): Promise<Document | null> {
  return prisma.document.findUnique({
    where: { slug },
  });
}

/**
 * Update document
 */
export async function updateDocument(
  prisma: PrismaClient,
  id: string,
  updates: Partial<DocumentInput>
): Promise<Document> {
  if (updates.slug) {
    // Validate slug format
    if (!/^[a-z0-9_-]+$/.test(updates.slug)) {
      throw new Error('slug must contain only lowercase letters, numbers, hyphens, and underscores');
    }
    // Check if new slug already exists
    const existing = await prisma.document.findFirst({
      where: {
        slug: updates.slug,
        id: { not: id },
      },
    });
    if (existing) {
      throw new Error(`Document with slug "${updates.slug}" already exists`);
    }
  }

  const updateData: any = {};
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.slug !== undefined) updateData.slug = updates.slug;
  if (updates.description !== undefined) updateData.description = updates.description ?? null;
  if (updates.categoryId !== undefined) updateData.categoryId = updates.categoryId ?? null;
  if (updates.tags !== undefined) updateData.tags = updates.tags;
  if (updates.status !== undefined) {
    updateData.status = updates.status;
    // Set publishedAt when status changes to published
    if (updates.status === DocumentStatus.PUBLISHED) {
      const current = await prisma.document.findUnique({ where: { id } });
      if (current && current.status !== DocumentStatus.PUBLISHED) {
        updateData.publishedAt = new Date();
      }
    }
  }

  return prisma.document.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Update document status
 */
export async function updateDocumentStatus(
  prisma: PrismaClient,
  id: string,
  status: DocumentStatus
): Promise<Document> {
  if (!Object.values(DocumentStatus).includes(status)) {
    throw new Error(`status must be one of: ${Object.values(DocumentStatus).join(', ')}`);
  }

  const updateData: any = { status };
  if (status === DocumentStatus.PUBLISHED) {
    const current = await prisma.document.findUnique({ where: { id } });
    if (current && current.status !== DocumentStatus.PUBLISHED) {
      updateData.publishedAt = new Date();
    }
  }

  return prisma.document.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Delete document
 */
export async function deleteDocument(
  prisma: PrismaClient,
  id: string
): Promise<Document> {
  return prisma.document.delete({
    where: { id },
  });
}

/**
 * List documents with filters
 */
export async function listDocuments(
  prisma: PrismaClient,
  filters?: {
    status?: DocumentStatus;
    categoryId?: string;
    authorId?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }
): Promise<Document[]> {
  const where: any = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.categoryId) where.categoryId = filters.categoryId;
  if (filters?.authorId) where.authorId = filters.authorId;
  if (filters?.tags && filters.tags.length > 0) {
    where.tags = { hasEvery: filters.tags };
  }

  return prisma.document.findMany({
    where,
    take: filters?.limit ?? 100,
    skip: filters?.offset ?? 0,
    orderBy: { createdAt: 'desc' },
  });
}

