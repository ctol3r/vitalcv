/**
 * B250B-DOC-011: DocumentService
 * Provides methods to createDocument, updateMetadata, publishDocument, archiveDocument
 * Validates input, updates Document.status and DocumentHistory, checks permissions
 */

import { PrismaClient, DocumentStatus } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const CreateDocumentSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional(),
});

const UpdateMetadataSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

export interface CreateDocumentParams {
  title: string;
  content?: string;
  category?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  authorId: string;
}

export interface UpdateMetadataParams {
  documentId: string;
  title?: string;
  category?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  userId: string;
}

export interface PublishDocumentParams {
  documentId: string;
  userId: string;
}

export interface ArchiveDocumentParams {
  documentId: string;
  userId: string;
}

export class DocumentService {
  /**
   * Create a new document
   */
  async createDocument(params: CreateDocumentParams) {
    // Validate input
    const validated = CreateDocumentSchema.parse({
      title: params.title,
      content: params.content,
      category: params.category,
      tags: params.tags || [],
      metadata: params.metadata,
    });

    // Check permissions - user must be authenticated
    const user = await prisma.user.findUnique({
      where: { id: params.authorId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Create document
    const document = await prisma.document.create({
      data: {
        title: validated.title,
        content: validated.content,
        category: validated.category,
        tags: validated.tags,
        metadata: validated.metadata,
        authorId: params.authorId,
        status: DocumentStatus.DRAFT,
      },
    });

    // Create initial history entry
    await prisma.documentHistory.create({
      data: {
        documentId: document.id,
        action: 'CREATE',
        performedById: params.authorId,
        changes: {
          title: validated.title,
          status: DocumentStatus.DRAFT,
        },
      },
    });

    return document;
  }

  /**
   * Update document metadata
   */
  async updateMetadata(params: UpdateMetadataParams) {
    // Validate input
    const validated = UpdateMetadataSchema.parse({
      title: params.title,
      category: params.category,
      tags: params.tags,
      metadata: params.metadata,
    });

    // Get document
    const document = await prisma.document.findUnique({
      where: { id: params.documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Check permissions - user must be author or have write access
    const hasAccess = await this.checkWriteAccess(params.documentId, params.userId);
    if (!hasAccess) {
      throw new Error('Insufficient permissions to update document');
    }

    // Build update data
    const updateData: any = {};
    if (validated.title !== undefined) updateData.title = validated.title;
    if (validated.category !== undefined) updateData.category = validated.category;
    if (validated.tags !== undefined) updateData.tags = validated.tags;
    if (validated.metadata !== undefined) updateData.metadata = validated.metadata;

    // Update document
    const updated = await prisma.document.update({
      where: { id: params.documentId },
      data: updateData,
    });

    // Create history entry
    await prisma.documentHistory.create({
      data: {
        documentId: params.documentId,
        action: 'UPDATE',
        performedById: params.userId,
        changes: updateData,
      },
    });

    return updated;
  }

  /**
   * Publish a document
   */
  async publishDocument(params: PublishDocumentParams) {
    // Get document
    const document = await prisma.document.findUnique({
      where: { id: params.documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Check permissions - user must be author or have admin access
    const hasAccess = await this.checkAdminAccess(params.documentId, params.userId);
    if (!hasAccess) {
      throw new Error('Insufficient permissions to publish document');
    }

    // Validate document can be published
    if (document.status === DocumentStatus.ARCHIVED) {
      throw new Error('Cannot publish archived document');
    }

    if (document.status === DocumentStatus.DELETED) {
      throw new Error('Cannot publish deleted document');
    }

    // Update document status
    const updated = await prisma.document.update({
      where: { id: params.documentId },
      data: {
        status: DocumentStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });

    // Create history entry
    await prisma.documentHistory.create({
      data: {
        documentId: params.documentId,
        action: 'PUBLISH',
        performedById: params.userId,
        changes: {
          status: DocumentStatus.PUBLISHED,
          publishedAt: updated.publishedAt,
        },
      },
    });

    return updated;
  }

  /**
   * Archive a document
   */
  async archiveDocument(params: ArchiveDocumentParams) {
    // Get document
    const document = await prisma.document.findUnique({
      where: { id: params.documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Check permissions - user must be author or have admin access
    const hasAccess = await this.checkAdminAccess(params.documentId, params.userId);
    if (!hasAccess) {
      throw new Error('Insufficient permissions to archive document');
    }

    // Update document status
    const updated = await prisma.document.update({
      where: { id: params.documentId },
      data: {
        status: DocumentStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    // Create history entry
    await prisma.documentHistory.create({
      data: {
        documentId: params.documentId,
        action: 'ARCHIVE',
        performedById: params.userId,
        changes: {
          status: DocumentStatus.ARCHIVED,
          archivedAt: updated.archivedAt,
        },
      },
    });

    return updated;
  }

  /**
   * Check if user has write access to document
   */
  private async checkWriteAccess(documentId: string, userId: string): Promise<boolean> {
    // Check if user is the author
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
        accessLevel: {
          in: ['WRITE', 'ADMIN'],
        },
      },
    });

    return !!access;
  }

  /**
   * Check if user has admin access to document
   */
  private async checkAdminAccess(documentId: string, userId: string): Promise<boolean> {
    // Check if user is the author
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
        accessLevel: 'ADMIN',
      },
    });

    return !!access;
  }
}

export const documentService = new DocumentService();

