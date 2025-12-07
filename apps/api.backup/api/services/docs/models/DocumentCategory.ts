/**
 * B250A-DOC-004: DocumentCategory Model
 *
 * Model for document categories with hierarchical organization support
 */

import { PrismaClient } from '@prisma/client';

export interface DocumentCategoryInput {
  name: string;
  slug: string;
  description?: string;
  parentCategoryId?: string;
}

export interface DocumentCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentCategoryId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate document category input
 */
export function validateDocumentCategoryInput(input: DocumentCategoryInput): void {
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
 * Check for cyclic parent relationships
 */
async function checkForCycles(
  prisma: PrismaClient,
  categoryId: string,
  parentCategoryId: string
): Promise<void> {
  let currentParentId: string | null = parentCategoryId;
  const visited = new Set<string>([categoryId]);

  while (currentParentId) {
    if (visited.has(currentParentId)) {
      throw new Error('Cyclic parent relationship detected');
    }
    visited.add(currentParentId);

    const parent = await prisma.documentCategory.findUnique({
      where: { id: currentParentId },
      select: { parentCategoryId: true },
    });

    if (!parent) {
      break;
    }

    currentParentId = parent.parentCategoryId;
  }
}

/**
 * Create document category
 */
export async function createDocumentCategory(
  prisma: PrismaClient,
  input: DocumentCategoryInput
): Promise<DocumentCategory> {
  validateDocumentCategoryInput(input);

  // Check if slug already exists
  const existing = await prisma.documentCategory.findUnique({
    where: { slug: input.slug },
  });

  if (existing) {
    throw new Error(`Category with slug "${input.slug}" already exists`);
  }

  // If parent is specified, verify it exists and check for cycles
  if (input.parentCategoryId) {
    const parent = await prisma.documentCategory.findUnique({
      where: { id: input.parentCategoryId },
    });

    if (!parent) {
      throw new Error(`Parent category with id "${input.parentCategoryId}" not found`);
    }

    // Note: We can't check for cycles on create since the category doesn't exist yet
    // But we'll validate on update
  }

  return prisma.documentCategory.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      parentCategoryId: input.parentCategoryId ?? null,
    },
  });
}

/**
 * Get document category by ID
 */
export async function getDocumentCategoryById(
  prisma: PrismaClient,
  id: string
): Promise<DocumentCategory | null> {
  return prisma.documentCategory.findUnique({
    where: { id },
  });
}

/**
 * Get document category by slug
 */
export async function getDocumentCategoryBySlug(
  prisma: PrismaClient,
  slug: string
): Promise<DocumentCategory | null> {
  return prisma.documentCategory.findUnique({
    where: { slug },
  });
}

/**
 * Update document category
 */
export async function updateDocumentCategory(
  prisma: PrismaClient,
  id: string,
  updates: Partial<DocumentCategoryInput>
): Promise<DocumentCategory> {
  if (updates.slug) {
    // Validate slug format
    if (!/^[a-z0-9_-]+$/.test(updates.slug)) {
      throw new Error('slug must contain only lowercase letters, numbers, hyphens, and underscores');
    }
    // Check if new slug already exists
    const existing = await prisma.documentCategory.findFirst({
      where: {
        slug: updates.slug,
        id: { not: id },
      },
    });
    if (existing) {
      throw new Error(`Category with slug "${updates.slug}" already exists`);
    }
  }

  // If parent is being updated, check for cycles
  if (updates.parentCategoryId !== undefined) {
    if (updates.parentCategoryId) {
      const parent = await prisma.documentCategory.findUnique({
        where: { id: updates.parentCategoryId },
      });

      if (!parent) {
        throw new Error(`Parent category with id "${updates.parentCategoryId}" not found`);
      }

      // Check for cycles
      await checkForCycles(prisma, id, updates.parentCategoryId);
    }
  }

  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.slug !== undefined) updateData.slug = updates.slug;
  if (updates.description !== undefined) updateData.description = updates.description ?? null;
  if (updates.parentCategoryId !== undefined) {
    updateData.parentCategoryId = updates.parentCategoryId ?? null;
  }

  return prisma.documentCategory.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Delete document category
 */
export async function deleteDocumentCategory(
  prisma: PrismaClient,
  id: string
): Promise<DocumentCategory> {
  // Check if category has children
  const children = await prisma.documentCategory.findMany({
    where: { parentCategoryId: id },
  });

  if (children.length > 0) {
    throw new Error('Cannot delete category with child categories');
  }

  // Check if category has documents
  const documents = await prisma.document.findMany({
    where: { categoryId: id },
    take: 1,
  });

  if (documents.length > 0) {
    throw new Error('Cannot delete category with associated documents');
  }

  return prisma.documentCategory.delete({
    where: { id },
  });
}

/**
 * List all document categories
 */
export async function listDocumentCategories(
  prisma: PrismaClient,
  filters?: {
    parentCategoryId?: string | null;
    limit?: number;
    offset?: number;
  }
): Promise<DocumentCategory[]> {
  const where: any = {};
  if (filters?.parentCategoryId !== undefined) {
    where.parentCategoryId = filters.parentCategoryId;
  }

  return prisma.documentCategory.findMany({
    where,
    take: filters?.limit ?? 100,
    skip: filters?.offset ?? 0,
    orderBy: { name: 'asc' },
  });
}

/**
 * Get category hierarchy (all ancestors)
 */
export async function getCategoryHierarchy(
  prisma: PrismaClient,
  categoryId: string
): Promise<DocumentCategory[]> {
  const hierarchy: DocumentCategory[] = [];
  let currentId: string | null = categoryId;

  while (currentId) {
    const category = await prisma.documentCategory.findUnique({
      where: { id: currentId },
    });

    if (!category) {
      break;
    }

    hierarchy.unshift(category);
    currentId = category.parentCategoryId;
  }

  return hierarchy;
}

/**
 * Get all child categories (recursive)
 */
export async function getChildCategories(
  prisma: PrismaClient,
  categoryId: string
): Promise<DocumentCategory[]> {
  const children: DocumentCategory[] = [];
  const directChildren = await prisma.documentCategory.findMany({
    where: { parentCategoryId: categoryId },
  });

  for (const child of directChildren) {
    children.push(child);
    const grandchildren = await getChildCategories(prisma, child.id);
    children.push(...grandchildren);
  }

  return children;
}

