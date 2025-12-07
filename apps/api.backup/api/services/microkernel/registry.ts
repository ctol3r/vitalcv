/**
 * Microkernel Module Registry
 *
 * Manages domain modules and their capabilities:
 * - Module discovery and registration
 * - Capability queries (tasks/events/flows)
 * - Module health tracking
 * - Policy overrides
 */

import { z } from 'zod';
import { createLogger } from '@chai-vc/logging-core';

const log = createLogger({ service: 'microkernel-registry' });

// ============================================================
// TYPES & SCHEMAS
// ============================================================

export interface ModuleCapability {
  /** Unique capability identifier */
  id: string;
  /** Type: task, event, or flow */
  type: 'task' | 'event' | 'flow';
  /** Capability name/description */
  name: string;
  /** Input schema (optional) */
  inputSchema?: z.ZodSchema<any>;
  /** Output schema (optional) */
  outputSchema?: z.ZodSchema<any>;
  /** Dependencies on other capabilities */
  dependencies?: string[];
}

export interface ModuleHealth {
  /** Module uptime in seconds */
  uptime: number;
  /** Average latency in milliseconds */
  latency: number;
  /** Failure rate (0-1) */
  failureRate: number;
  /** Last error message (if any) */
  lastError?: string;
  /** Timestamp of last error */
  lastErrorAt?: Date;
  /** Event throughput (events per second) */
  eventThroughput: number;
  /** Last health check timestamp */
  lastChecked: Date;
}

export interface ModulePolicy {
  /** Whether module can override supervisor policies */
  canOverridePolicies: boolean;
  /** Custom routing rules */
  routingRules?: Record<string, any>;
  /** Priority override */
  priority?: number;
}

export interface ModuleMetadata {
  /** Module version */
  version: string;
  /** Module description */
  description?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Author/maintainer */
  author?: string;
  /** Dependencies on other modules */
  moduleDependencies?: string[];
}

export const ModuleRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  capabilities: z.array(z.any()).default([]),
  health: z.any().optional(),
  policy: z.any().optional(),
  metadata: z.any().optional(),
  registeredAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export interface ModuleRecord {
  id: string;
  name: string;
  enabled: boolean;
  capabilities: ModuleCapability[];
  health?: ModuleHealth;
  policy?: ModulePolicy;
  metadata?: ModuleMetadata;
  registeredAt: Date;
  updatedAt: Date;
}

// ============================================================
// MODULE REGISTRY CLASS
// ============================================================

export class ModuleRegistry {
  private modules: Map<string, ModuleRecord> = new Map();
  private static instance: ModuleRegistry;

  private constructor() {}

  static getInstance(): ModuleRegistry {
    if (!ModuleRegistry.instance) {
      ModuleRegistry.instance = new ModuleRegistry();
    }
    return ModuleRegistry.instance;
  }

  /**
   * Register a module
   */
  register(module: Omit<ModuleRecord, 'registeredAt' | 'updatedAt'>): ModuleRecord {
    const record: ModuleRecord = {
      ...module,
      registeredAt: new Date(),
      updatedAt: new Date(),
    };

    this.modules.set(module.id, record);
    log.info('Module registered', { moduleId: module.id, capabilities: module.capabilities.length });

    return record;
  }

  /**
   * Update module registration
   */
  update(id: string, updates: Partial<ModuleRecord>): ModuleRecord {
    const existing = this.modules.get(id);
    if (!existing) {
      throw new Error(`Module ${id} not found`);
    }

    const updated: ModuleRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    this.modules.set(id, updated);
    log.debug('Module updated', { moduleId: id, updates: Object.keys(updates) });

    return updated;
  }

  /**
   * Get module by ID
   */
  get(id: string): ModuleRecord | undefined {
    return this.modules.get(id);
  }

  /**
   * Get all registered modules
   */
  getAll(): ModuleRecord[] {
    return Array.from(this.modules.values());
  }

  /**
   * Get enabled modules only
   */
  getEnabled(): ModuleRecord[] {
    return this.getAll().filter(m => m.enabled);
  }

  /**
   * Get modules by capability type
   */
  getByCapabilityType(type: 'task' | 'event' | 'flow'): ModuleRecord[] {
    return this.getAll().filter(m =>
      m.capabilities.some(cap => cap.type === type)
    );
  }

  /**
   * Get modules that have a specific capability ID
   */
  getByCapabilityId(capabilityId: string): ModuleRecord[] {
    return this.getAll().filter(m =>
      m.capabilities.some(cap => cap.id === capabilityId)
    );
  }

  /**
   * Get capabilities for a module
   */
  getCapabilities(moduleId: string): ModuleCapability[] {
    const module = this.modules.get(moduleId);
    return module?.capabilities ?? [];
  }

  /**
   * Find modules that can handle a capability
   */
  findModulesForCapability(capabilityId: string): ModuleRecord[] {
    return this.getEnabled().filter(m =>
      m.capabilities.some(cap => cap.id === capabilityId)
    );
  }

  /**
   * Enable/disable a module
   */
  setEnabled(id: string, enabled: boolean): ModuleRecord {
    return this.update(id, { enabled });
  }

  /**
   * Update module health
   */
  updateHealth(id: string, health: ModuleHealth): void {
    const module = this.modules.get(id);
    if (!module) {
      throw new Error(`Module ${id} not found`);
    }

    this.modules.set(id, {
      ...module,
      health,
      updatedAt: new Date(),
    });
  }

  /**
   * Get module health
   */
  getHealth(id: string): ModuleHealth | undefined {
    return this.modules.get(id)?.health;
  }

  /**
   * Check if module can override policies
   */
  canOverridePolicies(moduleId: string): boolean {
    return this.modules.get(moduleId)?.policy?.canOverridePolicies ?? false;
  }

  /**
   * Get module dependencies
   */
  getDependencies(moduleId: string): string[] {
    const module = this.modules.get(moduleId);
    return module?.metadata?.moduleDependencies ?? [];
  }

  /**
   * Clear all modules (for testing)
   */
  clear(): void {
    this.modules.clear();
  }
}

// ============================================================
// EXPORTS
// ============================================================

export const moduleRegistry = ModuleRegistry.getInstance();
export default moduleRegistry;

