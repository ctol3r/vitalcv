import { SyncQueueService } from '../models/SyncQueue';
import { DeviceNetworkStatusService } from './deviceNetworkStatusService';
import { ConflictResolutionService } from '../strategies/conflictResolutionStrategy';
import { SyncStatus, SyncOperationType } from '@prisma/client';

export interface SyncConfig {
  batchSize?: number;
  retryDelay?: number; // Initial retry delay in ms
  maxRetries?: number;
  exponentialBackoff?: boolean;
  conflictResolver?: ConflictResolutionService;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * SyncSchedulerService processes SyncQueue items when online
 * Includes exponential backoff and retry logic
 */
export class SyncSchedulerService {
  private isProcessing: boolean = false;
  private processingInterval?: NodeJS.Timeout;
  private networkStatusService: DeviceNetworkStatusService;
  private config: Required<SyncConfig>;

  constructor(
    private syncQueue: SyncQueueService,
    networkStatusService: DeviceNetworkStatusService,
    config: SyncConfig = {}
  ) {
    this.networkStatusService = networkStatusService;
    this.config = {
      batchSize: config.batchSize || 10,
      retryDelay: config.retryDelay || 1000,
      maxRetries: config.maxRetries || 3,
      exponentialBackoff: config.exponentialBackoff !== false,
      conflictResolver: config.conflictResolver || new ConflictResolutionService(),
    };

    // Listen for network status changes
    this.networkStatusService.onStatusChange(() => {
      if (this.networkStatusService.isOnline() && !this.isProcessing) {
        this.startProcessing();
      } else if (this.networkStatusService.isOffline()) {
        this.stopProcessing();
      }
    });
  }

  /**
   * Start processing sync queue
   */
  startProcessing(intervalMs: number = 5000): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    // Process immediately if online
    if (this.networkStatusService.isOnline()) {
      this.processSyncQueue().catch((error) => {
        console.error('Error in initial sync processing:', error);
      });
    }

    // Set up interval for periodic processing
    this.processingInterval = setInterval(() => {
      if (this.networkStatusService.isOnline()) {
        this.processSyncQueue().catch((error) => {
          console.error('Error in periodic sync processing:', error);
        });
      }
    }, intervalMs);
  }

  /**
   * Stop processing sync queue
   */
  stopProcessing(): void {
    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
  }

  /**
   * Process pending sync queue items
   */
  async processSyncQueue(userId?: string): Promise<SyncResult> {
    if (!this.networkStatusService.isOnline()) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: [{ id: 'network', error: 'Device is offline' }],
      };
    }

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    try {
      const pendingItems = await this.syncQueue.getPending({
        userId,
        limit: this.config.batchSize,
      });

      for (const item of pendingItems) {
        try {
          // Mark as syncing
          await this.syncQueue.markSyncing(item.id);

          // Check retry count
          if (item.retryCount >= this.config.maxRetries) {
            await this.syncQueue.markError(
              item.id,
              `Max retries (${this.config.maxRetries}) exceeded`
            );
            result.failed++;
            result.errors.push({
              id: item.id,
              error: 'Max retries exceeded',
            });
            continue;
          }

          // Process the sync operation
          const success = await this.processSyncItem(item);

          if (success) {
            await this.syncQueue.markSynced(item.id);
            result.synced++;
          } else {
            // Calculate retry delay with exponential backoff
            const delay = this.config.exponentialBackoff
              ? this.config.retryDelay * Math.pow(2, item.retryCount)
              : this.config.retryDelay;

            // Reset for retry after delay
            setTimeout(async () => {
              await this.syncQueue.resetForRetry(item.id);
            }, delay);

            result.failed++;
          }
        } catch (error: any) {
          const errorMessage = error?.message || 'Unknown error';
          await this.syncQueue.markError(item.id, errorMessage);
          result.failed++;
          result.errors.push({
            id: item.id,
            error: errorMessage,
          });
        }
      }

      result.success = result.failed === 0;
    } catch (error: any) {
      result.success = false;
      result.errors.push({
        id: 'processing',
        error: error?.message || 'Failed to process sync queue',
      });
    }

    return result;
  }

  /**
   * Process a single sync item
   * This should be overridden or extended to call actual API endpoints
   */
  protected async processSyncItem(item: any): Promise<boolean> {
    // This is a placeholder - actual implementation should:
    // 1. Call the appropriate API endpoint based on entityType and operationType
    // 2. Handle conflicts using the conflict resolver
    // 3. Return true on success, false on failure

    try {
      // Example: Map entityType to API endpoint
      const endpoint = this.getEndpointForEntity(item.entityType);
      const method = this.getMethodForOperation(item.operationType);

      // In a real implementation, you would make an HTTP request here
      // const response = await fetch(endpoint, {
      //   method,
      //   body: JSON.stringify(item.payload),
      //   headers: { 'Content-Type': 'application/json' },
      // });
      // return response.ok;

      // For now, simulate success
      console.log(`[SyncScheduler] Processing ${item.operationType} for ${item.entityType}:`, item.id);
      return true;
    } catch (error) {
      console.error(`[SyncScheduler] Error processing item ${item.id}:`, error);
      return false;
    }
  }

  /**
   * Get API endpoint for entity type
   * Override this method to provide actual endpoint mapping
   */
  protected getEndpointForEntity(entityType: string): string {
    return `/api/${entityType.toLowerCase()}`;
  }

  /**
   * Get HTTP method for operation type
   */
  protected getMethodForOperation(operationType: SyncOperationType): string {
    switch (operationType) {
      case SyncOperationType.CREATE:
        return 'POST';
      case SyncOperationType.UPDATE:
        return 'PATCH';
      case SyncOperationType.DELETE:
        return 'DELETE';
      default:
        return 'POST';
    }
  }

  /**
   * Get sync statistics
   */
  async getStats(userId?: string): Promise<{
    pending: number;
    syncing: number;
    synced: number;
    error: number;
  }> {
    const [pending, syncing, synced, error] = await Promise.all([
      this.syncQueue.countByStatus('PENDING' as SyncStatus, userId),
      this.syncQueue.countByStatus('SYNCING' as SyncStatus, userId),
      this.syncQueue.countByStatus('SYNCED' as SyncStatus, userId),
      this.syncQueue.countByStatus('ERROR' as SyncStatus, userId),
    ]);

    return { pending, syncing, synced, error };
  }
}

