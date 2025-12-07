/**
 * MobileBatchSyncAPI
 *
 * API to synchronise multiple data entities in a single request:
 * - Accepts nested structures for different entity types (e.g. forms, tasks, messages)
 * - Validates per-entity
 * - Returns consolidated results
 * - Supports versioning
 */

import { z } from 'zod';

export interface BatchSyncEntity {
  id: string;
  type: 'form' | 'task' | 'message' | 'profile' | 'document' | string;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  version?: number;
  timestamp: number;
}

export interface BatchSyncRequest {
  entities: BatchSyncEntity[];
  deviceId: string;
  syncToken?: string;
  version?: string; // API version
}

export interface EntitySyncResult {
  id: string;
  type: string;
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
  version?: number;
  conflicts?: {
    serverVersion: number;
    clientVersion: number;
  };
}

export interface BatchSyncResponse {
  results: EntitySyncResult[];
  partialSuccess: boolean;
  nextSyncToken?: string;
  version: string;
  summary: {
    total: number;
    successful: number;
    failed: number;
    conflicts: number;
  };
}

// Validation schemas
const batchSyncEntitySchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  operation: z.enum(['create', 'update', 'delete']),
  data: z.record(z.unknown()),
  version: z.number().int().positive().optional(),
  timestamp: z.number().int().positive(),
});

const batchSyncRequestSchema = z.object({
  entities: z.array(batchSyncEntitySchema).min(1).max(500),
  deviceId: z.string().min(1),
  syncToken: z.string().optional(),
  version: z.string().optional(),
});

/**
 * Validates a batch sync request
 */
export function validateBatchSyncRequest(payload: unknown): BatchSyncRequest {
  return batchSyncRequestSchema.parse(payload);
}

/**
 * Batch sync API controller
 * Handles synchronization of multiple entity types in a single request
 */
export class MobileBatchSyncAPI {
  private apiVersion = '1.0';

  /**
   * Process batch sync request
   */
  async processBatchSync(request: BatchSyncRequest): Promise<BatchSyncResponse> {
    const results: EntitySyncResult[] = [];
    let hasFailures = false;
    let hasConflicts = false;

    // Group entities by type for efficient processing
    const entitiesByType = this.groupEntitiesByType(request.entities);

    // Process each entity type group
    for (const [type, entities] of Object.entries(entitiesByType)) {
      const typeResults = await this.processEntityType(type, entities);
      results.push(...typeResults);

      // Check for failures and conflicts
      for (const result of typeResults) {
        if (!result.success) {
          hasFailures = true;
        }
        if (result.conflicts) {
          hasConflicts = true;
        }
      }
    }

    // Calculate summary
    const summary = {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      conflicts: results.filter((r) => r.conflicts).length,
    };

    return {
      results,
      partialSuccess: hasFailures && summary.successful > 0,
      nextSyncToken: this.generateSyncToken(),
      version: this.apiVersion,
      summary,
    };
  }

  /**
   * Group entities by type
   */
  private groupEntitiesByType(
    entities: BatchSyncEntity[],
  ): Record<string, BatchSyncEntity[]> {
    const grouped: Record<string, BatchSyncEntity[]> = {};

    for (const entity of entities) {
      if (!grouped[entity.type]) {
        grouped[entity.type] = [];
      }
      grouped[entity.type].push(entity);
    }

    return grouped;
  }

  /**
   * Process entities of a specific type
   */
  private async processEntityType(
    type: string,
    entities: BatchSyncEntity[],
  ): Promise<EntitySyncResult[]> {
    const results: EntitySyncResult[] = [];

    for (const entity of entities) {
      try {
        const result = await this.processEntity(entity);
        results.push({
          id: entity.id,
          type: entity.type,
          success: true,
          data: result.data,
          version: result.version,
        });
      } catch (error) {
        // Check if it's a conflict error
        if (error instanceof ConflictError) {
          results.push({
            id: entity.id,
            type: entity.type,
            success: false,
            error: error.message,
            conflicts: {
              serverVersion: error.serverVersion,
              clientVersion: error.clientVersion,
            },
          });
        } else {
          results.push({
            id: entity.id,
            type: entity.type,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return results;
  }

  /**
   * Process a single entity
   */
  private async processEntity(
    entity: BatchSyncEntity,
  ): Promise<{ data?: Record<string, unknown>; version?: number }> {
    // Validate entity-specific data
    this.validateEntityData(entity);

    // Check for conflicts
    if (entity.operation === 'update' && entity.version !== undefined) {
      await this.checkConflicts(entity);
    }

    // Process based on operation type
    switch (entity.operation) {
      case 'create':
        return this.handleCreate(entity);
      case 'update':
        return this.handleUpdate(entity);
      case 'delete':
        return this.handleDelete(entity);
      default:
        throw new Error(`Unknown operation: ${entity.operation}`);
    }
  }

  /**
   * Validate entity data based on type
   */
  private validateEntityData(entity: BatchSyncEntity): void {
    // In production, use type-specific validation schemas
    switch (entity.type) {
      case 'form':
        this.validateFormData(entity.data);
        break;
      case 'task':
        this.validateTaskData(entity.data);
        break;
      case 'message':
        this.validateMessageData(entity.data);
        break;
      default:
        // Generic validation
        if (!entity.data || typeof entity.data !== 'object') {
          throw new Error(`Invalid data for entity type ${entity.type}`);
        }
    }
  }

  /**
   * Validate form data
   */
  private validateFormData(data: Record<string, unknown>): void {
    if (!data.formId || !data.fields) {
      throw new Error('Form data must include formId and fields');
    }
  }

  /**
   * Validate task data
   */
  private validateTaskData(data: Record<string, unknown>): void {
    if (!data.title || !data.status) {
      throw new Error('Task data must include title and status');
    }
  }

  /**
   * Validate message data
   */
  private validateMessageData(data: Record<string, unknown>): void {
    if (!data.content || !data.recipientId) {
      throw new Error('Message data must include content and recipientId');
    }
  }

  /**
   * Check for version conflicts
   */
  private async checkConflicts(entity: BatchSyncEntity): Promise<void> {
    // Stub: In production, check actual server version
    const serverVersion = entity.version! + 1; // Simulate conflict detection

    if (serverVersion !== entity.version) {
      throw new ConflictError(
        `Version conflict for ${entity.type} ${entity.id}`,
        serverVersion,
        entity.version!,
      );
    }
  }

  /**
   * Handle create operation
   */
  private async handleCreate(
    entity: BatchSyncEntity,
  ): Promise<{ data: Record<string, unknown>; version: number }> {
    // Stub: In production, create entity in database
    return {
      data: { ...entity.data, id: entity.id },
      version: 1,
    };
  }

  /**
   * Handle update operation
   */
  private async handleUpdate(
    entity: BatchSyncEntity,
  ): Promise<{ data: Record<string, unknown>; version: number }> {
    if (entity.version === undefined) {
      throw new Error('Version required for update operations');
    }

    // Stub: In production, update entity in database
    return {
      data: { ...entity.data, id: entity.id },
      version: entity.version + 1,
    };
  }

  /**
   * Handle delete operation
   */
  private async handleDelete(
    entity: BatchSyncEntity,
  ): Promise<{ data?: Record<string, unknown>; version?: number }> {
    // Stub: In production, delete entity from database
    return {};
  }

  /**
   * Generate sync token
   */
  private generateSyncToken(): string {
    return `batch_sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get supported entity types
   */
  getSupportedEntityTypes(): string[] {
    return ['form', 'task', 'message', 'profile', 'document'];
  }

  /**
   * Get API version
   */
  getApiVersion(): string {
    return this.apiVersion;
  }
}

/**
 * Conflict error for version mismatches
 */
export class ConflictError extends Error {
  constructor(
    message: string,
    public serverVersion: number,
    public clientVersion: number,
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}

export const mobileBatchSyncAPI = new MobileBatchSyncAPI();

