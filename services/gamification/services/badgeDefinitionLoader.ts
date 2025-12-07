/**
 * BadgeDefinitionLoader
 * B247B-GAM-013: Loads badge definitions from DB or configuration; caches definitions; ensures criteria JSON is valid; supports hot reload; includes tests
 */

import { PrismaClient, Badge } from '@prisma/client';
import { BadgeModel, BadgeCriteria } from '../models/Badge';

export interface BadgeDefinition {
  id: string;
  name: string;
  slug: string;
  description?: string;
  criteria: BadgeCriteria;
  iconId?: string;
  level: number;
  isActive: boolean;
}

export class BadgeDefinitionLoader {
  private cache: Map<string, BadgeDefinition> = new Map();
  private cacheTimestamp: Date | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private badgeModel: BadgeModel;

  constructor(private prisma: PrismaClient) {
    this.badgeModel = new BadgeModel(prisma);
  }

  /**
   * Load all badge definitions (from cache if available)
   */
  async loadAll(forceRefresh: boolean = false): Promise<BadgeDefinition[]> {
    if (!forceRefresh && this.isCacheValid()) {
      return Array.from(this.cache.values());
    }

    const badges = await this.badgeModel.findActive();
    const definitions = badges.map((badge) => this.mapToDefinition(badge));

    // Validate all criteria
    for (const def of definitions) {
      this.validateCriteria(def.criteria);
    }

    // Update cache
    this.cache.clear();
    for (const def of definitions) {
      this.cache.set(def.id, def);
      this.cache.set(def.slug, def);
    }
    this.cacheTimestamp = new Date();

    return definitions;
  }

  /**
   * Load a single badge definition by ID or slug
   */
  async loadByIdOrSlug(idOrSlug: string): Promise<BadgeDefinition | null> {
    // Check cache first
    if (this.isCacheValid()) {
      const cached = this.cache.get(idOrSlug);
      if (cached) {
        return cached;
      }
    }

    // Load from database
    let badge: Badge | null = null;
    if (idOrSlug.length === 25) {
      // Likely a CUID
      badge = await this.badgeModel.findById(idOrSlug);
    } else {
      // Likely a slug
      badge = await this.badgeModel.findBySlug(idOrSlug);
    }

    if (!badge || !badge.isActive) {
      return null;
    }

    const definition = this.mapToDefinition(badge);
    this.validateCriteria(definition.criteria);

    // Update cache
    this.cache.set(definition.id, definition);
    this.cache.set(definition.slug, definition);
    this.cacheTimestamp = new Date();

    return definition;
  }

  /**
   * Hot reload - refresh cache from database
   */
  async reload(): Promise<void> {
    await this.loadAll(true);
  }

  /**
   * Get badge definition from cache only (no DB lookup)
   */
  getFromCache(idOrSlug: string): BadgeDefinition | null {
    if (!this.isCacheValid()) {
      return null;
    }
    return this.cache.get(idOrSlug) || null;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamp = null;
  }

  /**
   * Validate badge criteria structure
   */
  private validateCriteria(criteria: BadgeCriteria): void {
    if (!criteria || typeof criteria !== 'object') {
      throw new Error('Criteria must be an object');
    }

    if (!criteria.type) {
      throw new Error('Criteria must have a type');
    }

    const validTypes = ['point_threshold', 'action_count', 'streak', 'composite'];
    if (!validTypes.includes(criteria.type)) {
      throw new Error(`Invalid criteria type: ${criteria.type}`);
    }

    switch (criteria.type) {
      case 'point_threshold':
        if (criteria.value === undefined || typeof criteria.value !== 'number') {
          throw new Error('point_threshold criteria must have a numeric value');
        }
        break;

      case 'action_count':
        if (!criteria.action || typeof criteria.action !== 'string') {
          throw new Error('action_count criteria must have an action string');
        }
        if (criteria.value === undefined || typeof criteria.value !== 'number') {
          throw new Error('action_count criteria must have a numeric value');
        }
        break;

      case 'streak':
        if (criteria.days === undefined || typeof criteria.days !== 'number') {
          throw new Error('streak criteria must have a numeric days value');
        }
        break;

      case 'composite':
        if (!criteria.conditions || !Array.isArray(criteria.conditions)) {
          throw new Error('composite criteria must have a conditions array');
        }
        if (!criteria.operator || !['AND', 'OR'].includes(criteria.operator)) {
          throw new Error('composite criteria must have an operator (AND or OR)');
        }
        // Recursively validate conditions
        for (const condition of criteria.conditions) {
          this.validateCriteria(condition);
        }
        break;
    }
  }

  /**
   * Map Prisma Badge to BadgeDefinition
   */
  private mapToDefinition(badge: Badge): BadgeDefinition {
    return {
      id: badge.id,
      name: badge.name,
      slug: badge.slug,
      description: badge.description || undefined,
      criteria: badge.criteria as BadgeCriteria,
      iconId: badge.iconId || undefined,
      level: badge.level,
      isActive: badge.isActive,
    };
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    if (!this.cacheTimestamp) {
      return false;
    }
    const age = Date.now() - this.cacheTimestamp.getTime();
    return age < this.CACHE_TTL_MS;
  }
}

