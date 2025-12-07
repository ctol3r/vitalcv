/**
 * B250B-DOC-014: DocumentAccessService
 * Manages granting/revoking access: grantAccess(documentId, userId, accessLevel), revokeAccess
 * Checks RBAC; integrates with AuthZ system
 */

import { PrismaClient, DocumentAccessLevel } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const GrantAccessSchema = z.object({
  documentId: z.string(),
  userId: z.string().optional(),
  role: z.string().optional(),
  accessLevel: z.nativeEnum(DocumentAccessLevel),
  grantedById: z.string(),
});

export interface GrantAccessParams {
  documentId: string;
  userId?: string;
  role?: string;
  accessLevel: DocumentAccessLevel;
  grantedById: string;
}

export interface RevokeAccessParams {
  documentId: string;
  userId?: string;
  role?: string;
  revokedById: string;
}

export class DocumentAccessService {
  /**
   * Grant access to a document
   */
  async grantAccess(params: GrantAccessParams) {
    // Validate input
    const validated = GrantAccessSchema.parse(params);

    // Must provide either userId or role, but not both
    if (!validated.userId && !validated.role) {
      throw new Error('Must provide either userId or role');
    }

    if (validated.userId && validated.role) {
      throw new Error('Cannot provide both userId and role');
    }

    // Verify document exists
    const document = await prisma.document.findUnique({
      where: { id: validated.documentId },
      select: { id: true, authorId: true },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Check permissions - granter must be author or have admin access
    const canGrant = await this.checkCanGrantAccess(validated.documentId, validated.grantedById);
    if (!canGrant) {
      throw new Error('Insufficient permissions to grant access');
    }

    // If userId provided, verify user exists
    if (validated.userId) {
      const user = await prisma.user.findUnique({
        where: { id: validated.userId },
      });

      if (!user) {
        throw new Error('User not found');
      }
    }

    // Revoke any existing access first
    await prisma.documentAccess.updateMany({
      where: {
        documentId: validated.documentId,
        userId: validated.userId || undefined,
        role: validated.role || undefined,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    // Grant new access
    const access = await prisma.documentAccess.create({
      data: {
        documentId: validated.documentId,
        userId: validated.userId,
        role: validated.role,
        accessLevel: validated.accessLevel,
        grantedById: validated.grantedById,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        granter: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return access;
  }

  /**
   * Revoke access to a document
   */
  async revokeAccess(params: RevokeAccessParams) {
    // Must provide either userId or role
    if (!params.userId && !params.role) {
      throw new Error('Must provide either userId or role');
    }

    // Verify document exists
    const document = await prisma.document.findUnique({
      where: { id: params.documentId },
      select: { id: true },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Check permissions - revoker must be author or have admin access
    const canRevoke = await this.checkCanGrantAccess(params.documentId, params.revokedById);
    if (!canRevoke) {
      throw new Error('Insufficient permissions to revoke access');
    }

    // Revoke access
    const result = await prisma.documentAccess.updateMany({
      where: {
        documentId: params.documentId,
        userId: params.userId || undefined,
        role: params.role || undefined,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { revoked: result.count > 0 };
  }

  /**
   * Get access list for a document
   */
  async getAccessList(documentId: string) {
    return prisma.documentAccess.findMany({
      where: {
        documentId,
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
        granter: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        grantedAt: 'desc',
      },
    });
  }

  /**
   * Check if user can grant/revoke access
   */
  private async checkCanGrantAccess(documentId: string, userId: string): Promise<boolean> {
    // Check if user is the author
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { authorId: true },
    });

    if (document?.authorId === userId) {
      return true;
    }

    // Check if user has admin access
    const access = await prisma.documentAccess.findFirst({
      where: {
        documentId,
        userId,
        revokedAt: null,
        accessLevel: 'ADMIN',
      },
    });

    return !!access;
  }

  /**
   * Check if user has access to document
   */
  async checkAccess(documentId: string, userId: string, requiredLevel: DocumentAccessLevel): Promise<boolean> {
    // Check if user is the author (has all access)
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { authorId: true },
    });

    if (document?.authorId === userId) {
      return true;
    }

    // Check explicit access grants
    const access = await prisma.documentAccess.findFirst({
      where: {
        documentId,
        userId,
        revokedAt: null,
      },
    });

    if (!access) {
      return false;
    }

    // Check access level hierarchy: ADMIN > WRITE > READ
    const levelHierarchy: Record<DocumentAccessLevel, number> = {
      READ: 1,
      WRITE: 2,
      ADMIN: 3,
    };

    return levelHierarchy[access.accessLevel] >= levelHierarchy[requiredLevel];
  }
}

export const documentAccessService = new DocumentAccessService();

