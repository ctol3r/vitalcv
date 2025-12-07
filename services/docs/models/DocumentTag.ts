/**
 * B250A-DOC-003: DocumentTag Model and Mapping
 *
 * Model for document tags with many-to-many relationship support
 */

import { PrismaClient } from '@prisma/client';

export interface DocumentTagInput {
  name: string;
  slug: string;
  description?: string;
}

export interface DocumentTag {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentTagMap {
  documentId: string;
  tagId: string;
  createdAt: Date;
}

/**
 * Validate document tag input
 */
export function validateDocumentTagInput(input: DocumentTagInput): void {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('name is required');
  }
  if (!input.slug || input.slug.trim().length === 0) {
    throw new Error('slug is required');
  }
  // Validate slug format
  if (!/^[a-z0-9_-]+$/.test(input.slug)) {
    throw new Error('slug must contain only lowercase letters, numbers, hyphens, and underscores');
  }
}

/**
 * Create document tag
 */
export async function createDocumentTag(
  prisma: PrismaClient,
  input: DocumentTagInput
): Promise<DocumentTag> {
  validateDocumentTagInput(input);

  // Check if slug already exists
  const existing = await prisma.documentTag.findUnique({
    where: { slug: input.slug },
  });

  if (existing) {
    throw new Error(`Tag with slug "${input.slug}" already exists`);
  }

  return prisma.documentTag.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
    },
  });
}

/**
 * Get document tag by ID
 */
export async function getDocumentTagById(
  prisma: PrismaClient,
  id: string
): Promise<DocumentTag | null> {
  return prisma.documentTag.findUnique({
    where: { id },
  });
}

/**
 * Get document tag by slug
 */
export async function getDocumentTagBySlug(
  prisma: PrismaClient,
  slug: string
): Promise<DocumentTag | null> {
  return prisma.documentTag.findUnique({
    where: { slug },
  });
}

/**
 * Update document tag
 */
export async function updateDocumentTag(
  prisma: PrismaClient,
  id: string,
  updates: Partial<DocumentTagInput>
): Promise<DocumentTag> {
  if (updates.slug) {
    // Validate slug format
    if (!/^[a-z0-9_-]+$/.test(updates.slug)) {
      throw new Error('slug must contain only lowercase letters, numbers, hyphens, and underscores');
    }
    // Check if new slug already exists
    const existing = await prisma.documentTag.findFirst({
      where: {
        slug: updates.slug,
        id: { not: id },
      },
    });
    if (existing) {
      throw new Error(`Tag with slug "${updates.slug}" already exists`);
    }
  }

  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.slug !== undefined) updateData.slug = updates.slug;
  if (updates.description !== undefined) updateData.description = updates.description ?? null;

  return prisma.documentTag.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Delete document tag
 */
export async function deleteDocumentTag(
  prisma: PrismaClient,
  id: string
): Promise<DocumentTag> {
  return prisma.documentTag.delete({
    where: { id },
  });
}

/**
 * List all document tags
 */
export async function listDocumentTags(
  prisma: PrismaClient,
  filters?: {
    limit?: number;
    offset?: number;
  }
): Promise<DocumentTag[]> {
  return prisma.documentTag.findMany({
    take: filters?.limit ?? 100,
    skip: filters?.offset ?? 0,
    orderBy: { name: 'asc' },
  });
}

/**
 * Add tag to document (create mapping)
 */
export async function addTagToDocument(
  prisma: PrismaClient,
  documentId: string,
  tagId: string
): Promise<DocumentTagMap> {
  // Verify document exists
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });
  if (!document) {
    throw new Error(`Document with id "${documentId}" not found`);
  }

  // Verify tag exists
  const tag = await prisma.documentTag.findUnique({
    where: { id: tagId },
  });
  if (!tag) {
    throw new Error(`Tag with id "${tagId}" not found`);
  }

  // Check if mapping already exists
  const existing = await prisma.documentTagMap.findUnique({
    where: {
      documentId_tagId: {
        documentId,
        tagId,
      },
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.documentTagMap.create({
    data: {
      documentId,
      tagId,
    },
  });
}

/**
 * Remove tag from document (delete mapping)
 */
export async function removeTagFromDocument(
  prisma: PrismaClient,
  documentId: string,
  tagId: string
): Promise<void> {
  await prisma.documentTagMap.delete({
    where: {
      documentId_tagId: {
        documentId,
        tagId,
      },
    },
  });
}

/**
 * Get all tags for a document
 */
export async function getDocumentTags(
  prisma: PrismaClient,
  documentId: string
): Promise<DocumentTag[]> {
  const mappings = await prisma.documentTagMap.findMany({
    where: { documentId },
    include: { tag: true },
  });

  return mappings.map((m: any) => m.tag);
}

/**
 * Get all documents for a tag
 */
export async function getTagDocuments(
  prisma: PrismaClient,
  tagId: string
): Promise<any[]> {
  const mappings = await prisma.documentTagMap.findMany({
    where: { tagId },
    include: { document: true },
  });

  return mappings.map((m: any) => m.document);
}

