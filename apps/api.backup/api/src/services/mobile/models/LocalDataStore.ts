import { PrismaClient, LocalDataStore } from '@prisma/client';

export interface LocalDataStoreInput {
  key: string;
  value: string;
  entityType: string;
  userId?: string;
}

export interface LocalDataStoreQuery {
  userId?: string;
  entityType?: string;
  key?: string;
}

/**
 * LocalDataStore service for managing offline data storage
 * Supports multiple tables/entity types and user-scoped data
 */
export class LocalDataStoreService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Save or update data in the local store
   */
  async save(input: LocalDataStoreInput): Promise<LocalDataStore> {
    const { key, value, entityType, userId } = input;

    return this.prisma.localDataStore.upsert({
      where: {
        userId_key_entityType: {
          userId: userId || '',
          key,
          entityType,
        },
      },
      create: {
        key,
        value,
        entityType,
        userId: userId || null,
        timestamp: new Date(),
      },
      update: {
        value,
        timestamp: new Date(),
      },
    });
  }

  /**
   * Retrieve data by key and entity type
   */
  async get(key: string, entityType: string, userId?: string): Promise<LocalDataStore | null> {
    return this.prisma.localDataStore.findUnique({
      where: {
        userId_key_entityType: {
          userId: userId || '',
          key,
          entityType,
        },
      },
    });
  }

  /**
   * Retrieve all data matching query criteria
   */
  async query(query: LocalDataStoreQuery): Promise<LocalDataStore[]> {
    const where: any = {};

    if (query.userId !== undefined) {
      where.userId = query.userId || null;
    }
    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.key) {
      where.key = query.key;
    }

    return this.prisma.localDataStore.findMany({
      where,
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  /**
   * Delete data by key and entity type
   */
  async delete(key: string, entityType: string, userId?: string): Promise<void> {
    await this.prisma.localDataStore.deleteMany({
      where: {
        key,
        entityType,
        userId: userId || null,
      },
    });
  }

  /**
   * Clear all data for a user and/or entity type
   */
  async clear(userId?: string, entityType?: string): Promise<number> {
    const where: any = {};

    if (userId !== undefined) {
      where.userId = userId || null;
    }
    if (entityType) {
      where.entityType = entityType;
    }

    const result = await this.prisma.localDataStore.deleteMany({ where });
    return result.count;
  }

  /**
   * Get count of stored items
   */
  async count(query?: LocalDataStoreQuery): Promise<number> {
    const where: any = {};

    if (query) {
      if (query.userId !== undefined) {
        where.userId = query.userId || null;
      }
      if (query.entityType) {
        where.entityType = query.entityType;
      }
      if (query.key) {
        where.key = query.key;
      }
    }

    return this.prisma.localDataStore.count({ where });
  }
}

