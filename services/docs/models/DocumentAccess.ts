/**
 * B250A-DOC-007: DocumentAccess Model
 *
 * Model for document access control with user and role-based permissions
 */

import { PrismaClient } from '@prisma/client';

export enum AccessLevel {
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin',
}

export interface DocumentAccessInput {
  documentId: string;
  userId?: string;
  role?: string;
  accessLevel: AccessLevel;
  grantedBy: string;
}

export interface DocumentAccess {
  id: string;
  documentId: string;
  userId: string | null;
  role: string | null;
  accessLevel: AccessLevel;
  grantedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate document access input
 */
export function validateDocumentAccessInput(input: DocumentAccessInput): void {
  if (!input.documentId || input.documentId.trim().length === 0) {
    throw new Error('documentId is required');
  }
  if (!input.grantedBy || input.grantedBy.trim().length === 0) {
    throw new Error('grantedBy is required');
  }
  if (!Object.values(AccessLevel).includes(input.accessLevel)) {
    throw new Error(`accessLevel must be one of: ${Object.values(AccessLevel).join(', ')}`);
  }
  if (!input.userId && !input.role) {
    throw new Error('Either userId or role must be provided');
  }
  if (input.userId && input.role) {
    throw new Error('Cannot specify both userId and role');
  }
}

/**
 * Create document access entry
 */
export async function createDocumentAccess(
  prisma: PrismaClient,
  input: DocumentAccessInput
): Promise<DocumentAccess> {
  validateDocumentAccessInput(input);

  // Verify document exists
  const document = await prisma.document.findUnique({
    where: { id: input.documentId },
  });

  if (!document) {
    throw new Error(`Document with id "${input.documentId}" not found`);
  }

  // Check if access entry already exists
  const existing = await prisma.documentAccess.findFirst({
    where: {
      documentId: input.documentId,
      userId: input.userId ?? null,
      role: input.role ?? null,
    },
  });

  if (existing) {
    // Update existing entry
    return prisma.documentAccess.update({
      where: { id: existing.id },
      data: {
        accessLevel: input.accessLevel,
        grantedBy: input.grantedBy,
      },
    });
  }

  return prisma.documentAccess.create({
    data: {
      documentId: input.documentId,
      userId: input.userId ?? null,
      role: input.role ?? null,
      accessLevel: input.accessLevel,
      grantedBy: input.grantedBy,
    },
  });
}

/**
 * Get document access by ID
 */
export async function getDocumentAccessById(
  prisma: PrismaClient,
  id: string
): Promise<DocumentAccess | null> {
  return prisma.documentAccess.findUnique({
    where: { id },
  });
}

/**
 * Get all access entries for a document
 */
export async function getDocumentAccesses(
  prisma: PrismaClient,
  documentId: string
): Promise<DocumentAccess[]> {
  return prisma.documentAccess.findMany({
    where: { documentId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get access for a specific user
 */
export async function getUserDocumentAccess(
  prisma: PrismaClient,
  documentId: string,
  userId: string
): Promise<DocumentAccess | null> {
  return prisma.documentAccess.findFirst({
    where: {
      documentId,
      userId,
    },
  });
}

/**
 * Get access for a specific role
 */
export async function getRoleDocumentAccess(
  prisma: PrismaClient,
  documentId: string,
  role: string
): Promise<DocumentAccess | null> {
  return prisma.documentAccess.findFirst({
    where: {
      documentId,
      role,
    },
  });
}

/**
 * Check if user has access to document
 */
export async function checkDocumentAccess(
  prisma: PrismaClient,
  documentId: string,
  userId: string,
  userRoles: string[],
  requiredLevel: AccessLevel
): Promise<boolean> {
  // Check user-specific access
  const userAccess = await prisma.documentAccess.findFirst({
    where: {
      documentId,
      userId,
    },
  });

  if (userAccess) {
    const levelOrder = { read: 1, write: 2, admin: 3 };
    return levelOrder[userAccess.accessLevel] >= levelOrder[requiredLevel];
  }

  // Check role-based access
  for (const role of userRoles) {
    const roleAccess = await prisma.documentAccess.findFirst({
      where: {
        documentId,
        role,
      },
    });

    if (roleAccess) {
      const levelOrder = { read: 1, write: 2, admin: 3 };
      return levelOrder[roleAccess.accessLevel] >= levelOrder[requiredLevel];
    }
  }

  // Check if user is the document author (default read access)
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { authorId: true },
  });

  if (document && document.authorId === userId) {
    return requiredLevel === AccessLevel.READ;
  }

  return false;
}

/**
 * Update document access
 */
export async function updateDocumentAccess(
  prisma: PrismaClient,
  id: string,
  updates: {
    accessLevel?: AccessLevel;
    grantedBy?: string;
  }
): Promise<DocumentAccess> {
  if (updates.accessLevel && !Object.values(AccessLevel).includes(updates.accessLevel)) {
    throw new Error(`accessLevel must be one of: ${Object.values(AccessLevel).join(', ')}`);
  }

  const updateData: any = {};
  if (updates.accessLevel !== undefined) updateData.accessLevel = updates.accessLevel;
  if (updates.grantedBy !== undefined) updateData.grantedBy = updates.grantedBy;

  return prisma.documentAccess.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Delete document access
 */
export async function deleteDocumentAccess(
  prisma: PrismaClient,
  id: string
): Promise<DocumentAccess> {
  return prisma.documentAccess.delete({
    where: { id },
  });
}

/**
 * Remove access for a user
 */
export async function removeUserAccess(
  prisma: PrismaClient,
  documentId: string,
  userId: string
): Promise<void> {
  await prisma.documentAccess.deleteMany({
    where: {
      documentId,
      userId,
    },
  });
}

/**
 * Remove access for a role
 */
export async function removeRoleAccess(
  prisma: PrismaClient,
  documentId: string,
  role: string
): Promise<void> {
  await prisma.documentAccess.deleteMany({
    where: {
      documentId,
      role,
    },
  });
}

