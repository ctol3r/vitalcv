import { PrismaClient, SyncQueue, SyncOperationType, SyncStatus } from '@prisma/client';

export interface SyncQueueItemInput {
  entityType: string;
  operationType: SyncOperationType;
  payload: any;
  userId?: string;
}

export interface SyncQueueQuery {
  userId?: string;
  entityType?: string;
  status?: SyncStatus;
  limit?: number;
}

/**
 * SyncQueue service for managing pending offline operations
 * Ensures FIFO ordering and tracks sync status
 */
export class SyncQueueService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Add an operation to the sync queue
   */
  async enqueue(input: SyncQueueItemInput): Promise<SyncQueue> {
    return this.prisma.syncQueue.create({
      data: {
        entityType: input.entityType,
        operationType: input.operationType,
        payload: input.payload,
        userId: input.userId || null,
        status: SyncStatus.PENDING,
      },
    });
  }

  /**
   * Get next pending items in FIFO order
   */
  async getPending(query?: SyncQueueQuery): Promise<SyncQueue[]> {
    const where: any = {
      status: SyncStatus.PENDING,
    };

    if (query?.userId !== undefined) {
      where.userId = query.userId || null;
    }
    if (query?.entityType) {
      where.entityType = query.entityType;
    }

    return this.prisma.syncQueue.findMany({
      where,
      orderBy: {
        createdAt: 'asc', // FIFO ordering
      },
      take: query?.limit || 100,
    });
  }

  /**
   * Mark an item as syncing
   */
  async markSyncing(id: string): Promise<SyncQueue> {
    return this.prisma.syncQueue.update({
      where: { id },
      data: {
        status: SyncStatus.SYNCING,
      },
    });
  }

  /**
   * Mark an item as successfully synced
   */
  async markSynced(id: string): Promise<SyncQueue> {
    return this.prisma.syncQueue.update({
      where: { id },
      data: {
        status: SyncStatus.SYNCED,
        syncedAt: new Date(),
      },
    });
  }

  /**
   * Mark an item as errored with retry count
   */
  async markError(id: string, errorMessage: string): Promise<SyncQueue> {
    const item = await this.prisma.syncQueue.findUnique({ where: { id } });
    if (!item) {
      throw new Error(`SyncQueue item ${id} not found`);
    }

    return this.prisma.syncQueue.update({
      where: { id },
      data: {
        status: SyncStatus.ERROR,
        errorMessage,
        retryCount: item.retryCount + 1,
      },
    });
  }

  /**
   * Reset error status to pending for retry
   */
  async resetForRetry(id: string): Promise<SyncQueue> {
    return this.prisma.syncQueue.update({
      where: { id },
      data: {
        status: SyncStatus.PENDING,
        errorMessage: null,
      },
    });
  }

  /**
   * Get items by query criteria
   */
  async query(query: SyncQueueQuery): Promise<SyncQueue[]> {
    const where: any = {};

    if (query.userId !== undefined) {
      where.userId = query.userId || null;
    }
    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.status) {
      where.status = query.status;
    }

    return this.prisma.syncQueue.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: query.limit || 100,
    });
  }

  /**
   * Get count of items by status
   */
  async countByStatus(status: SyncStatus, userId?: string): Promise<number> {
    const where: any = { status };
    if (userId !== undefined) {
      where.userId = userId || null;
    }

    return this.prisma.syncQueue.count({ where });
  }

  /**
   * Delete synced items older than specified days
   */
  async cleanupSynced(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.syncQueue.deleteMany({
      where: {
        status: SyncStatus.SYNCED,
        syncedAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}

