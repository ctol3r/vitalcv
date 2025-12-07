/**
 * Status List Registry with Automatic Rollover
 * Tagged: cursor-batch-1105 (Task 0005)
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * Manages multiple status lists and handles automatic rollover
 */

import StatusList, { StatusListCredential } from './statusList';

export interface StatusListMetadata {
  listId: string;
  purpose: 'revocation' | 'suspension';
  createdAt: Date;
  currentIndex: number; // Next available index
  maxCapacity: number;
  isActive: boolean; // false if rolled over
  successorListId?: string; // ID of the list that replaced this one
}

/**
 * Status List Registry
 * Manages multiple status lists with automatic rollover
 */
export class StatusListRegistry {
  private lists: Map<string, StatusList> = new Map();
  private metadata: Map<string, StatusListMetadata> = new Map();
  private activeListIds: Map<'revocation' | 'suspension', string> = new Map();

  /**
   * Rollover threshold (configurable via env)
   */
  private readonly rolloverThreshold: number;

  constructor(rolloverThreshold: number = 100000) {
    this.rolloverThreshold = rolloverThreshold;
  }

  /**
   * Get or create the active status list for a purpose
   */
  getActiveList(
    purpose: 'revocation' | 'suspension',
    issuer: string,
  ): {
    list: StatusList;
    metadata: StatusListMetadata;
  } {
    const activeListId = this.activeListIds.get(purpose);

    if (activeListId) {
      const list = this.lists.get(activeListId);
      const metadata = this.metadata.get(activeListId);

      if (list && metadata) {
        // Check if we need to rollover
        if (metadata.currentIndex >= this.rolloverThreshold) {
          return this.rolloverList(purpose, issuer);
        }

        return { list, metadata };
      }
    }

    // Create new list
    return this.createNewList(purpose, issuer);
  }

  /**
   * Create a new status list
   */
  private createNewList(
    purpose: 'revocation' | 'suspension',
    issuer: string,
  ): {
    list: StatusList;
    metadata: StatusListMetadata;
  } {
    const listId = crypto.randomUUID();
    const list = new StatusList(131072, purpose, listId, issuer);

    const metadata: StatusListMetadata = {
      listId,
      purpose,
      createdAt: new Date(),
      currentIndex: 0,
      maxCapacity: 131072,
      isActive: true,
    };

    this.lists.set(listId, list);
    this.metadata.set(listId, metadata);
    this.activeListIds.set(purpose, listId);

    return { list, metadata };
  }

  /**
   * Rollover to a new status list
   */
  private rolloverList(
    purpose: 'revocation' | 'suspension',
    issuer: string,
  ): {
    list: StatusList;
    metadata: StatusListMetadata;
  } {
    const oldListId = this.activeListIds.get(purpose);
    if (!oldListId) {
      return this.createNewList(purpose, issuer);
    }

    const oldMetadata = this.metadata.get(oldListId);
    if (oldMetadata) {
      // Mark old list as inactive
      oldMetadata.isActive = false;
    }

    // Create new list
    const { list, metadata } = this.createNewList(purpose, issuer);

    // Link old list to new list
    if (oldMetadata) {
      oldMetadata.successorListId = metadata.listId;
    }

    console.log(
      `[StatusListRegistry] Rolled over ${purpose} list: ${oldListId} -> ${metadata.listId}`,
    );

    return { list, metadata };
  }

  /**
   * Get a status list by ID (for reading old/archived lists)
   */
  getList(listId: string): StatusList | undefined {
    return this.lists.get(listId);
  }

  /**
   * Get metadata for a list
   */
  getMetadata(listId: string): StatusListMetadata | undefined {
    return this.metadata.get(listId);
  }

  /**
   * Allocate the next available index in the active list
   */
  allocateIndex(
    purpose: 'revocation' | 'suspension',
    issuer: string,
  ): {
    listId: string;
    index: number;
  } {
    const { list, metadata } = this.getActiveList(purpose, issuer);
    const index = metadata.currentIndex;

    metadata.currentIndex++;

    return {
      listId: metadata.listId,
      index,
    };
  }

  /**
   * Set a bit in a specific list
   */
  setBit(listId: string, index: number, value: boolean): void {
    const list = this.lists.get(listId);
    if (!list) {
      throw new Error(`Status list ${listId} not found`);
    }

    list.setBit(index, value);
  }

  /**
   * Get a bit from a specific list
   */
  getBit(listId: string, index: number): boolean {
    const list = this.lists.get(listId);
    if (!list) {
      throw new Error(`Status list ${listId} not found`);
    }

    return list.getBit(index);
  }

  /**
   * Get a status list credential by ID
   */
  async getStatusListCredential(listId: string): Promise<StatusListCredential | undefined> {
    const list = this.lists.get(listId);
    if (!list) {
      return undefined;
    }

    return list.toCredential();
  }

  /**
   * List all status lists
   */
  listAllLists(): Array<StatusListMetadata & { stats: any }> {
    return Array.from(this.metadata.values()).map((metadata) => {
      const list = this.lists.get(metadata.listId);
      const stats = list ? list.getStats() : null;
      return {
        ...metadata,
        stats,
      };
    });
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalLists: number;
    activeLists: number;
    rolloverThreshold: number;
  } {
    const activeLists = Array.from(this.metadata.values()).filter((m) => m.isActive).length;

    return {
      totalLists: this.lists.size,
      activeLists,
      rolloverThreshold: this.rolloverThreshold,
    };
  }
}

// Global registry instance
const globalRegistry = new StatusListRegistry(
  parseInt(process.env.STATUS_LIST_ROLLOVER_THRESHOLD || '100000', 10),
);

/**
 * Get the global status list registry
 */
export function getStatusListRegistry(): StatusListRegistry {
  return globalRegistry;
}
