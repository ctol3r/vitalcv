/**
 * B250A-DOC-006: DocumentHistory Model
 *
 * Model for tracking document lifecycle events for audit purposes
 */

import { PrismaClient } from '@prisma/client';

export enum DocumentEventType {
  CREATED = 'created',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  VERSION_ADDED = 'versionAdded',
  UPDATED = 'updated',
  DELETED = 'deleted',
}

export interface DocumentHistoryInput {
  documentId: string;
  eventType: DocumentEventType;
  userId: string;
  details?: Record<string, any>;
}

export interface DocumentHistory {
  id: string;
  documentId: string;
  eventType: DocumentEventType;
  userId: string;
  details: Record<string, any> | null;
  timestamp: Date;
}

/**
 * Validate document history input
 */
export function validateDocumentHistoryInput(input: DocumentHistoryInput): void {
  if (!input.documentId || input.documentId.trim().length === 0) {
    throw new Error('documentId is required');
  }
  if (!input.userId || input.userId.trim().length === 0) {
    throw new Error('userId is required');
  }
  if (!input.eventType || !Object.values(DocumentEventType).includes(input.eventType)) {
    throw new Error(`eventType must be one of: ${Object.values(DocumentEventType).join(', ')}`);
  }
}

/**
 * Create document history entry
 */
export async function createDocumentHistory(
  prisma: PrismaClient,
  input: DocumentHistoryInput
): Promise<DocumentHistory> {
  validateDocumentHistoryInput(input);

  // Verify document exists
  const document = await prisma.document.findUnique({
    where: { id: input.documentId },
  });

  if (!document) {
    throw new Error(`Document with id "${input.documentId}" not found`);
  }

  return prisma.documentHistory.create({
    data: {
      documentId: input.documentId,
      eventType: input.eventType,
      userId: input.userId,
      details: input.details ?? null, // Prisma handles JSON automatically
    },
  });
}

/**
 * Get document history by ID
 */
export async function getDocumentHistoryById(
  prisma: PrismaClient,
  id: string
): Promise<DocumentHistory | null> {
  const history = await prisma.documentHistory.findUnique({
    where: { id },
  });

  if (!history) return null;

  return history;
}

/**
 * Get all history entries for a document
 */
export async function getDocumentHistory(
  prisma: PrismaClient,
  documentId: string,
  filters?: {
    eventType?: DocumentEventType;
    limit?: number;
    offset?: number;
  }
): Promise<DocumentHistory[]> {
  const where: any = { documentId };
  if (filters?.eventType) {
    where.eventType = filters.eventType;
  }

  const histories = await prisma.documentHistory.findMany({
    where,
    take: filters?.limit ?? 100,
    skip: filters?.offset ?? 0,
    orderBy: { timestamp: 'desc' },
  });

  return histories;
}

/**
 * Get history entries by event type
 */
export async function getHistoryByEventType(
  prisma: PrismaClient,
  eventType: DocumentEventType,
  filters?: {
    limit?: number;
    offset?: number;
  }
): Promise<DocumentHistory[]> {
  const histories = await prisma.documentHistory.findMany({
    where: { eventType },
    take: filters?.limit ?? 100,
    skip: filters?.offset ?? 0,
    orderBy: { timestamp: 'desc' },
  });

  return histories;
}

/**
 * Get history entries by user
 */
export async function getHistoryByUser(
  prisma: PrismaClient,
  userId: string,
  filters?: {
    limit?: number;
    offset?: number;
  }
): Promise<DocumentHistory[]> {
  const histories = await prisma.documentHistory.findMany({
    where: { userId },
    take: filters?.limit ?? 100,
    skip: filters?.offset ?? 0,
    orderBy: { timestamp: 'desc' },
  });

  return histories;
}

