/**
 * B250B-DOC-012: DocumentVersioningService
 * Handles new version creation: duplicates current content if necessary,
 * increments versionNumber, saves changeSummary
 * Updates Document.currentVersionId if published
 * Ensures optimistic locking
 */

import { PrismaClient, DocumentStatus } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';

const prisma = new PrismaClient();

const CreateVersionSchema = z.object({
  documentId: z.string(),
  content: z.string().optional(),
  changeSummary: z.string().optional(),
  createdById: z.string(),
  versionToken: z.string().optional(), // For optimistic locking
});

export interface CreateVersionParams {
  documentId: string;
  content?: string;
  changeSummary?: string;
  createdById: string;
  versionToken?: string;
}

export class DocumentVersioningService {
  /**
   * Create a new version of a document
   */
  async createVersion(params: CreateVersionParams) {
    // Validate input
    const validated = CreateVersionSchema.parse(params);

    // Get document with current version
    const document = await prisma.document.findUnique({
      where: { id: validated.documentId },
      include: {
        currentVersion: true,
      },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Check optimistic locking if versionToken provided
    if (validated.versionToken) {
      const currentLock = await prisma.documentLock.findUnique({
        where: {
          documentId_userId: {
            documentId: validated.documentId,
            userId: validated.createdById,
          },
        },
      });

      if (!currentLock || currentLock.versionToken !== validated.versionToken) {
        throw new Error('Version token mismatch - document may have been modified');
      }

      if (currentLock.expiresAt < new Date()) {
        throw new Error('Version token expired');
      }
    }

    // Get the latest version number
    const latestVersion = await prisma.documentVersion.findFirst({
      where: { documentId: validated.documentId },
      orderBy: { versionNumber: 'desc' },
    });

    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    // If content not provided, duplicate current content
    let contentToSave = validated.content;
    if (!contentToSave && document.currentVersion) {
      contentToSave = document.currentVersion.content || null;
    }

    // Generate new version token
    const newVersionToken = crypto.randomBytes(32).toString('hex');

    // Create new version
    const version = await prisma.documentVersion.create({
      data: {
        documentId: validated.documentId,
        versionNumber: nextVersionNumber,
        content: contentToSave,
        changeSummary: validated.changeSummary,
        createdById: validated.createdById,
        versionToken: newVersionToken,
      },
    });

    // If document is published, update currentVersionId
    if (document.status === DocumentStatus.PUBLISHED) {
      await prisma.document.update({
        where: { id: validated.documentId },
        data: {
          currentVersionId: version.id,
        },
      });
    }

    // Update lock with new token
    await prisma.documentLock.upsert({
      where: {
        documentId_userId: {
          documentId: validated.documentId,
          userId: validated.createdById,
        },
      },
      create: {
        documentId: validated.documentId,
        userId: validated.createdById,
        versionToken: newVersionToken,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      },
      update: {
        versionToken: newVersionToken,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    return version;
  }

  /**
   * Get version by ID
   */
  async getVersion(versionId: string) {
    return prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: {
        creator: {
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
   * List all versions for a document
   */
  async listVersions(documentId: string) {
    return prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { versionNumber: 'desc' },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }
}

export const documentVersioningService = new DocumentVersioningService();

