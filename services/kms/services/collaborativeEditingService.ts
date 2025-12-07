/**
 * B243B-KMS-012: CollaborativeEditingService
 *
 * Enables real-time editing with basic locking mechanism.
 * When an editor opens an article, others can view but cannot edit.
 * Shows who is editing and supports auto-save and conflict resolution.
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';

const log = getServiceLogger('kms/collaborative-editing');

export interface EditingSession {
  id: string;
  articleId: string;
  editorId: string;
  editorName?: string;
  lockedAt: Date;
  expiresAt: Date;
}

export interface LockResult {
  success: boolean;
  session?: EditingSession;
  currentEditor?: {
      id: string;
      name?: string;
      lockedAt: Date;
  };
  error?: string;
}

const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const AUTO_SAVE_INTERVAL_MS = 30 * 1000; // 30 seconds

/**
 * Acquire a lock on an article for editing
 */
export async function acquireEditLock(
  prisma: PrismaClient,
  articleId: string,
  editorId: string
): Promise<LockResult> {
  try {
    // Check if there's an existing lock
    const existingSession = await prisma.collaborativeEditingSession.findUnique({
      where: { articleId },
      include: {
        article: {
          select: { id: true, title: true },
        },
      },
    });

    if (existingSession) {
      // Check if lock has expired
      if (existingSession.expiresAt < new Date()) {
        // Lock expired, remove it
        await prisma.collaborativeEditingSession.delete({
          where: { id: existingSession.id },
        });
      } else if (existingSession.editorId !== editorId) {
        // Lock is held by another user
        const editor = await prisma.user.findUnique({
          where: { id: existingSession.editorId },
          select: { id: true, name: true },
        });

        return {
          success: false,
          currentEditor: {
            id: existingSession.editorId,
            name: editor?.name || undefined,
            lockedAt: existingSession.lockedAt,
          },
          error: 'Article is currently being edited by another user',
        };
      } else {
        // Same editor, extend the lock
        const expiresAt = new Date(Date.now() + LOCK_DURATION_MS);
        const updated = await prisma.collaborativeEditingSession.update({
          where: { id: existingSession.id },
          data: { expiresAt, lockedAt: new Date() },
        });

        return {
          success: true,
          session: {
            id: updated.id,
            articleId: updated.articleId,
            editorId: updated.editorId,
            lockedAt: updated.lockedAt,
            expiresAt: updated.expiresAt,
          },
        };
      }
    }

    // Create new lock
    const expiresAt = new Date(Date.now() + LOCK_DURATION_MS);
    const session = await prisma.collaborativeEditingSession.create({
      data: {
        articleId,
        editorId,
        expiresAt,
      },
    });

    log.info('Edit lock acquired', { articleId, editorId, sessionId: session.id });

    return {
      success: true,
      session: {
        id: session.id,
        articleId: session.articleId,
        editorId: session.editorId,
        lockedAt: session.lockedAt,
        expiresAt: session.expiresAt,
      },
    };
  } catch (error) {
    log.error('Failed to acquire edit lock', { articleId, editorId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to acquire lock',
    };
  }
}

/**
 * Release a lock on an article
 */
export async function releaseEditLock(
  prisma: PrismaClient,
  articleId: string,
  editorId: string
): Promise<boolean> {
  try {
    const session = await prisma.collaborativeEditingSession.findUnique({
      where: { articleId },
    });

    if (!session) {
      return true; // Already released
    }

    if (session.editorId !== editorId) {
      log.warn('Attempt to release lock by non-owner', { articleId, editorId, ownerId: session.editorId });
      return false;
    }

    await prisma.collaborativeEditingSession.delete({
      where: { id: session.id },
    });

    log.info('Edit lock released', { articleId, editorId });
    return true;
  } catch (error) {
    log.error('Failed to release edit lock', { articleId, editorId, error });
    return false;
  }
}

/**
 * Get current editor of an article
 */
export async function getCurrentEditor(
  prisma: PrismaClient,
  articleId: string
): Promise<{ id: string; name?: string; lockedAt: Date } | null> {
  const session = await prisma.collaborativeEditingSession.findUnique({
    where: { articleId },
  });

  if (!session) {
    return null;
  }

  // Check if expired
  if (session.expiresAt < new Date()) {
    await prisma.collaborativeEditingSession.delete({
      where: { id: session.id },
    });
    return null;
  }

  const editor = await prisma.user.findUnique({
    where: { id: session.editorId },
    select: { id: true, name: true },
  });

  return {
    id: session.editorId,
    name: editor?.name || undefined,
    lockedAt: session.lockedAt,
  };
}

/**
 * Extend lock duration
 */
export async function extendEditLock(
  prisma: PrismaClient,
  articleId: string,
  editorId: string
): Promise<boolean> {
  try {
    const session = await prisma.collaborativeEditingSession.findUnique({
      where: { articleId },
    });

    if (!session || session.editorId !== editorId) {
      return false;
    }

    const expiresAt = new Date(Date.now() + LOCK_DURATION_MS);
    await prisma.collaborativeEditingSession.update({
      where: { id: session.id },
      data: { expiresAt, lockedAt: new Date() },
    });

    return true;
  } catch (error) {
    log.error('Failed to extend edit lock', { articleId, editorId, error });
    return false;
  }
}

/**
 * Auto-save article content
 */
export async function autoSaveArticle(
  prisma: PrismaClient,
  articleId: string,
  editorId: string,
  content: { title?: string; body?: string; summary?: string }
): Promise<boolean> {
  try {
    // Verify lock is still valid
    const session = await prisma.collaborativeEditingSession.findUnique({
      where: { articleId },
    });

    if (!session || session.editorId !== editorId) {
      log.warn('Auto-save attempted without valid lock', { articleId, editorId });
      return false;
    }

    // Update article
    await prisma.contentArticle.update({
      where: { id: articleId },
      data: {
        ...content,
        updatedAt: new Date(),
      },
    });

    // Extend lock
    await extendEditLock(prisma, articleId, editorId);

    log.debug('Article auto-saved', { articleId, editorId });
    return true;
  } catch (error) {
    log.error('Failed to auto-save article', { articleId, editorId, error });
    return false;
  }
}

/**
 * Clean up expired locks (should be run periodically)
 */
export async function cleanupExpiredLocks(prisma: PrismaClient): Promise<number> {
  const expired = await prisma.collaborativeEditingSession.findMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  if (expired.length > 0) {
    await prisma.collaborativeEditingSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    log.info('Cleaned up expired edit locks', { count: expired.length });
  }

  return expired.length;
}

