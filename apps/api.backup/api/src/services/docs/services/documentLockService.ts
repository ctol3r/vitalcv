/**
 * B250B-DOC-017: DocumentLockService
 * Provides optimistic locking during editing: issues version token when editing begins
 * Checks token before save; prevents simultaneous writes
 * Handles token expiry
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export interface AcquireLockParams {
  documentId: string;
  userId: string;
  ttlMinutes?: number;
}

export interface VerifyLockParams {
  documentId: string;
  userId: string;
  versionToken: string;
}

export class DocumentLockService {
  private readonly defaultTTLMinutes = 30;

  /**
   * Acquire a lock for editing a document
   */
  async acquireLock(params: AcquireLockParams): Promise<string> {
    const ttlMinutes = params.ttlMinutes || this.defaultTTLMinutes;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    // Check if document exists
    const document = await prisma.document.findUnique({
      where: { id: params.documentId },
      select: { id: true },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Check if there's an existing lock
    const existingLock = await prisma.documentLock.findUnique({
      where: {
        documentId_userId: {
          documentId: params.documentId,
          userId: params.userId,
        },
      },
    });

    // If lock exists and is not expired, return existing token
    if (existingLock && existingLock.expiresAt > new Date()) {
      return existingLock.versionToken;
    }

    // Generate new version token
    const versionToken = crypto.randomBytes(32).toString('hex');

    // Create or update lock
    await prisma.documentLock.upsert({
      where: {
        documentId_userId: {
          documentId: params.documentId,
          userId: params.userId,
        },
      },
      create: {
        documentId: params.documentId,
        userId: params.userId,
        versionToken,
        expiresAt,
      },
      update: {
        versionToken,
        expiresAt,
      },
    });

    return versionToken;
  }

  /**
   * Verify a lock token before saving
   */
  async verifyLock(params: VerifyLockParams): Promise<boolean> {
    const lock = await prisma.documentLock.findUnique({
      where: {
        documentId_userId: {
          documentId: params.documentId,
          userId: params.userId,
        },
      },
    });

    if (!lock) {
      return false;
    }

    if (lock.expiresAt < new Date()) {
      // Lock expired, clean it up
      await prisma.documentLock.delete({
        where: {
          documentId_userId: {
            documentId: params.documentId,
            userId: params.userId,
          },
        },
      });
      return false;
    }

    return lock.versionToken === params.versionToken;
  }

  /**
   * Release a lock
   */
  async releaseLock(documentId: string, userId: string): Promise<void> {
    await prisma.documentLock.deleteMany({
      where: {
        documentId,
        userId,
      },
    });
  }

  /**
   * Extend lock expiry
   */
  async extendLock(documentId: string, userId: string, additionalMinutes: number = 30): Promise<void> {
    const lock = await prisma.documentLock.findUnique({
      where: {
        documentId_userId: {
          documentId,
          userId,
        },
      },
    });

    if (!lock) {
      throw new Error('Lock not found');
    }

    if (lock.expiresAt < new Date()) {
      throw new Error('Lock has expired');
    }

    await prisma.documentLock.update({
      where: {
        documentId_userId: {
          documentId,
          userId,
        },
      },
      data: {
        expiresAt: new Date(Date.now() + additionalMinutes * 60 * 1000),
      },
    });
  }

  /**
   * Clean up expired locks (should be called periodically)
   */
  async cleanupExpiredLocks(): Promise<number> {
    const result = await prisma.documentLock.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  /**
   * Get lock status for a document
   */
  async getLockStatus(documentId: string) {
    const locks = await prisma.documentLock.findMany({
      where: {
        documentId,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return locks;
  }
}

export const documentLockService = new DocumentLockService();

