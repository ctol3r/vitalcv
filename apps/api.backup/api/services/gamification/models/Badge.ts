/**
 * Badge Model
 * B247B-GAM-011: Defines badge properties: id, name, slug, description, criteria (JSON), iconId, level (int), isActive, createdAt, updatedAt
 */

import { PrismaClient, Badge as PrismaBadge } from '@prisma/client';

export interface BadgeCriteria {
  type: 'point_threshold' | 'action_count' | 'streak' | 'composite';
  value?: number;
  action?: string;
  days?: number;
  conditions?: BadgeCriteria[];
  operator?: 'AND' | 'OR';
}

export interface BadgeCreateInput {
  name: string;
  slug: string;
  description?: string;
  criteria: BadgeCriteria;
  iconId?: string;
  level?: number;
  isActive?: boolean;
}

export interface BadgeUpdateInput {
  name?: string;
  slug?: string;
  description?: string;
  criteria?: BadgeCriteria;
  iconId?: string;
  level?: number;
  isActive?: boolean;
}

export class BadgeModel {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new badge
   */
  async create(data: BadgeCreateInput): Promise<PrismaBadge> {
    return this.prisma.badge.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        criteria: data.criteria as any,
        iconId: data.iconId,
        level: data.level ?? 1,
        isActive: data.isActive ?? true,
      },
    });
  }

  /**
   * Get badge by ID
   */
  async findById(id: string): Promise<PrismaBadge | null> {
    return this.prisma.badge.findUnique({
      where: { id },
    });
  }

  /**
   * Get badge by slug
   */
  async findBySlug(slug: string): Promise<PrismaBadge | null> {
    return this.prisma.badge.findUnique({
      where: { slug },
    });
  }

  /**
   * List all badges (optionally filtered by active status or level)
   */
  async list(filters?: {
    isActive?: boolean;
    level?: number;
    minLevel?: number;
    maxLevel?: number;
  }): Promise<PrismaBadge[]> {
    const where: any = {};

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.level !== undefined) {
      where.level = filters.level;
    } else {
      if (filters?.minLevel !== undefined) {
        where.level = { ...where.level, gte: filters.minLevel };
      }
      if (filters?.maxLevel !== undefined) {
        where.level = { ...where.level, lte: filters.maxLevel };
      }
    }

    return this.prisma.badge.findMany({
      where,
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Update badge
   */
  async update(id: string, data: BadgeUpdateInput): Promise<PrismaBadge> {
    return this.prisma.badge.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.criteria !== undefined && { criteria: data.criteria as any }),
        ...(data.iconId !== undefined && { iconId: data.iconId }),
        ...(data.level !== undefined && { level: data.level }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete badge
   */
  async delete(id: string): Promise<void> {
    await this.prisma.badge.delete({
      where: { id },
    });
  }

  /**
   * Get all active badges
   */
  async findActive(): Promise<PrismaBadge[]> {
    return this.list({ isActive: true });
  }
}

