/**
 * B247A-GAM-004: RewardsConfigService
 *
 * Loads action point configurations from DB or config file; caches values;
 * supports runtime updates; validates configurations
 */

import { PrismaClient } from '@prisma/client';
import {
  getActionPointsDefinition,
  getAllActiveActionPoints,
  upsertActionPointsDefinition,
  ActionPointsDefinition,
} from '../models/ActionPointsDefinition';
import { RewardActionType } from '../models/RewardPointsTransaction';

interface ConfigCache {
  pointsByAction: Map<RewardActionType, number>;
  definitions: Map<RewardActionType, ActionPointsDefinition>;
  lastUpdated: Date | null;
}

export class RewardsConfigService {
  private cache: ConfigCache = {
    pointsByAction: new Map(),
    definitions: new Map(),
    lastUpdated: null,
  };
  private cacheTtl: number; // Time in milliseconds before cache expires

  constructor(
    private prisma: PrismaClient,
    cacheTtlMs: number = 5 * 60 * 1000 // Default: 5 minutes
  ) {
    this.cacheTtl = cacheTtlMs;
  }

  /**
   * Load configurations from database
   */
  async loadFromDatabase(): Promise<void> {
    const definitions = await getAllActiveActionPoints(this.prisma);

    this.cache.pointsByAction.clear();
    this.cache.definitions.clear();

    for (const def of definitions) {
      this.cache.pointsByAction.set(def.actionType, def.points);
      this.cache.definitions.set(def.actionType, def);
    }

    this.cache.lastUpdated = new Date();
  }

  /**
   * Load default configurations from code (fallback)
   */
  private getDefaultConfigs(): Map<RewardActionType, number> {
    const defaults = new Map<RewardActionType, number>();
    defaults.set(RewardActionType.PROFILE_COMPLETE, 50);
    defaults.set(RewardActionType.DOCUMENT_UPLOAD, 25);
    defaults.set(RewardActionType.CREDENTIAL_VERIFIED, 100);
    defaults.set(RewardActionType.TRAINING_COMPLETED, 75);
    defaults.set(RewardActionType.COMMUNITY_POST, 10);
    defaults.set(RewardActionType.REFERRAL, 200);
    defaults.set(RewardActionType.DAILY_LOGIN, 5);
    defaults.set(RewardActionType.REDEMPTION, -1); // Negative for redemption
    defaults.set(RewardActionType.EXPIRATION, -1); // Negative for expiration
    return defaults;
  }

  /**
   * Get points for an action type (with caching)
   */
  async getPointsForAction(actionType: RewardActionType): Promise<number> {
    // Check if cache is valid
    if (
      !this.cache.lastUpdated ||
      Date.now() - this.cache.lastUpdated.getTime() > this.cacheTtl
    ) {
      await this.loadFromDatabase();
    }

    // Return from cache if available
    if (this.cache.pointsByAction.has(actionType)) {
      return this.cache.pointsByAction.get(actionType)!;
    }

    // Fallback to defaults
    const defaults = this.getDefaultConfigs();
    if (defaults.has(actionType)) {
      return defaults.get(actionType)!;
    }

    throw new Error(`No points configuration found for actionType: ${actionType}`);
  }

  /**
   * Get all active action point definitions (with caching)
   */
  async getActiveDefinitions(): Promise<ActionPointsDefinition[]> {
    // Check if cache is valid
    if (
      !this.cache.lastUpdated ||
      Date.now() - this.cache.lastUpdated.getTime() > this.cacheTtl
    ) {
      await this.loadFromDatabase();
    }

    return Array.from(this.cache.definitions.values());
  }

  /**
   * Update configuration for an action type (invalidates cache)
   */
  async updateActionPoints(
    actionType: RewardActionType,
    points: number,
    description: string,
    isActive: boolean = true
  ): Promise<ActionPointsDefinition> {
    const definition = await upsertActionPointsDefinition(this.prisma, {
      actionType,
      points,
      description,
      isActive,
    });

    // Invalidate cache
    this.cache.lastUpdated = null;

    return definition;
  }

  /**
   * Validate all configurations
   */
  async validateConfigurations(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const definitions = await getAllActiveActionPoints(this.prisma);

      for (const def of definitions) {
        if (def.points === 0 && def.actionType !== RewardActionType.REDEMPTION) {
          errors.push(`Action ${def.actionType} has zero points but is active`);
        }
        if (def.points > 1000) {
          errors.push(`Action ${def.actionType} has unusually high points: ${def.points}`);
        }
        if (!def.description || def.description.trim().length === 0) {
          errors.push(`Action ${def.actionType} has no description`);
        }
      }

      // Check for missing critical actions
      const criticalActions = [
        RewardActionType.PROFILE_COMPLETE,
        RewardActionType.CREDENTIAL_VERIFIED,
      ];

      for (const actionType of criticalActions) {
        const found = definitions.find((d) => d.actionType === actionType);
        if (!found) {
          errors.push(`Missing configuration for critical action: ${actionType}`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      errors.push(`Error validating configurations: ${error}`);
      return {
        valid: false,
        errors,
      };
    }
  }

  /**
   * Force reload of cache
   */
  async reloadCache(): Promise<void> {
    this.cache.lastUpdated = null;
    await this.loadFromDatabase();
  }

  /**
   * Initialize with default configurations if none exist
   */
  async initializeDefaults(): Promise<void> {
    const existing = await getAllActiveActionPoints(this.prisma);
    if (existing.length > 0) {
      return; // Already initialized
    }

    const defaults = this.getDefaultConfigs();
    const defaultDescriptions: Record<RewardActionType, string> = {
      [RewardActionType.PROFILE_COMPLETE]: 'Complete your profile',
      [RewardActionType.DOCUMENT_UPLOAD]: 'Upload a document',
      [RewardActionType.CREDENTIAL_VERIFIED]: 'Verify a credential',
      [RewardActionType.TRAINING_COMPLETED]: 'Complete a training course',
      [RewardActionType.COMMUNITY_POST]: 'Create a community post',
      [RewardActionType.REFERRAL]: 'Refer a new user',
      [RewardActionType.DAILY_LOGIN]: 'Daily login bonus',
      [RewardActionType.REDEMPTION]: 'Redeem points',
      [RewardActionType.EXPIRATION]: 'Points expired',
    };

    for (const [actionType, points] of defaults.entries()) {
      await upsertActionPointsDefinition(this.prisma, {
        actionType,
        points,
        description: defaultDescriptions[actionType],
        isActive: actionType !== RewardActionType.EXPIRATION, // Expiration is not a user action
      });
    }

    await this.reloadCache();
  }
}

