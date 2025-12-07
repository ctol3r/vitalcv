/**
 * B250B-DOC-018: CollaborativeEditingService
 * Integrates Yjs or similar CRDT library for real-time collaborative editing
 * Manages document rooms; resolves conflicts
 * Stores final content to DocumentVersion
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Note: This is a placeholder implementation
// In production, you would integrate with Yjs or similar CRDT library
// For now, we provide the interface and basic conflict resolution

const SaveCollaborativeContentSchema = z.object({
  documentId: z.string(),
  content: z.string(),
  userId: z.string(),
  changeSummary: z.string().optional(),
});

export interface CollaborativeRoom {
  documentId: string;
  participants: string[];
  createdAt: Date;
}

export interface SaveContentParams {
  documentId: string;
  content: string;
  userId: string;
  changeSummary?: string;
}

export class CollaborativeEditingService {
  // In-memory room storage (in production, use Redis or similar)
  private rooms: Map<string, CollaborativeRoom> = new Map();

  /**
   * Join a collaborative editing room
   */
  async joinRoom(documentId: string, userId: string): Promise<CollaborativeRoom> {
    // Verify document exists
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Get or create room
    let room = this.rooms.get(documentId);
    if (!room) {
      room = {
        documentId,
        participants: [],
        createdAt: new Date(),
      };
      this.rooms.set(documentId, room);
    }

    // Add participant if not already present
    if (!room.participants.includes(userId)) {
      room.participants.push(userId);
    }

    return room;
  }

  /**
   * Leave a collaborative editing room
   */
  async leaveRoom(documentId: string, userId: string): Promise<void> {
    const room = this.rooms.get(documentId);
    if (room) {
      room.participants = room.participants.filter((id) => id !== userId);
      if (room.participants.length === 0) {
        this.rooms.delete(documentId);
      }
    }
  }

  /**
   * Save collaborative content to DocumentVersion
   * This would be called after Yjs sync completes
   */
  async saveCollaborativeContent(params: SaveContentParams) {
    // Validate input
    const validated = SaveCollaborativeContentSchema.parse(params);

    // Get document
    const document = await prisma.document.findUnique({
      where: { id: validated.documentId },
      include: {
        currentVersion: true,
      },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Get latest version number
    const latestVersion = await prisma.documentVersion.findFirst({
      where: { documentId: validated.documentId },
      orderBy: { versionNumber: 'desc' },
    });

    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    // Create new version with merged content
    const version = await prisma.documentVersion.create({
      data: {
        documentId: validated.documentId,
        versionNumber: nextVersionNumber,
        content: validated.content,
        changeSummary: validated.changeSummary || 'Collaborative edit',
        createdById: validated.userId,
      },
    });

    // Update document content and current version if published
    if (document.status === 'PUBLISHED') {
      await prisma.document.update({
        where: { id: validated.documentId },
        data: {
          content: validated.content,
          currentVersionId: version.id,
        },
      });
    }

    return version;
  }

  /**
   * Resolve conflicts between concurrent edits
   * In production, this would use CRDT merge logic
   */
  async resolveConflicts(
    documentId: string,
    versions: Array<{ content: string; versionNumber: number }>
  ): Promise<string> {
    // Simple conflict resolution: use the most recent version
    // In production with Yjs, conflicts are automatically resolved by CRDT
    if (versions.length === 0) {
      throw new Error('No versions provided');
    }

    const latest = versions.reduce((prev, curr) =>
      curr.versionNumber > prev.versionNumber ? curr : prev
    );

    return latest.content;
  }

  /**
   * Get room participants
   */
  async getRoomParticipants(documentId: string): Promise<string[]> {
    const room = this.rooms.get(documentId);
    return room?.participants || [];
  }

  /**
   * Clean up empty rooms (should be called periodically)
   */
  async cleanupEmptyRooms(): Promise<number> {
    let cleaned = 0;
    for (const [documentId, room] of this.rooms.entries()) {
      if (room.participants.length === 0) {
        this.rooms.delete(documentId);
        cleaned++;
      }
    }
    return cleaned;
  }
}

export const collaborativeEditingService = new CollaborativeEditingService();

