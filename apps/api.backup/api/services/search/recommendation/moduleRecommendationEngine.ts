/**
 * B232B-SEARCH-007: ModuleRecommendationEngine
 *
 * Generates recommended modules for organizations and clinicians based on:
 * - Specialties
 * - Region
 * - Previous marketplace activity
 * - Trending modules
 * Updates daily.
 */

import { PrismaClient } from '@prisma/client';
import { searchAnalyticsTracker } from '../analytics/searchAnalyticsTracker.js';

const prisma = new PrismaClient();

export interface ModuleRecommendation {
  moduleId: string;
  moduleName: string;
  vendorId: string;
  vendorName?: string;
  score: number; // 0-1 recommendation score
  reasons: string[]; // Explanation of why this module was recommended
  matchFactors: {
    specialtyMatch?: number;
    regionMatch?: number;
    activityMatch?: number;
    trendingBoost?: number;
  };
}

export interface RecommendationContext {
  userId?: string;
  orgId?: string;
  specialty?: string;
  region?: string;
  previousPurchases?: string[]; // Module IDs already purchased
  limit?: number;
}

/**
 * ModuleRecommendationEngine - Generates personalized module recommendations
 */
export class ModuleRecommendationEngine {
  /**
   * Get recommended modules for a user or organization
   */
  async getRecommendations(context: RecommendationContext): Promise<ModuleRecommendation[]> {
    const limit = context.limit || 10;
    const recommendations: ModuleRecommendation[] = [];

    // Get all active modules
    const modules = await prisma.marketplaceModule.findMany({
      where: {
        approvalStatus: 'APPROVED',
      },
      include: {
        vendor: true,
      },
    });

    // Filter out already purchased modules
    const availableModules = modules.filter(
      (m) => !context.previousPurchases?.includes(m.id)
    );

    // Score each module
    for (const module of availableModules) {
      const score = await this.scoreModule(module.id, context);
      if (score.score > 0) {
        recommendations.push({
          moduleId: module.id,
          moduleName: module.name,
          vendorId: module.vendorId,
          vendorName: module.vendor.name,
          score: score.score,
          reasons: score.reasons,
          matchFactors: score.matchFactors,
        });
      }
    }

    // Sort by score and return top recommendations
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Score a module based on context
   */
  private async scoreModule(
    moduleId: string,
    context: RecommendationContext
  ): Promise<{
    score: number;
    reasons: string[];
    matchFactors: ModuleRecommendation['matchFactors'];
  }> {
    const module = await prisma.marketplaceModule.findUnique({
      where: { id: moduleId },
      include: { vendor: true },
    });

    if (!module) {
      return { score: 0, reasons: [], matchFactors: {} };
    }

    const reasons: string[] = [];
    const matchFactors: ModuleRecommendation['matchFactors'] = {};
    let score = 0;

    // 1. Specialty match (if module metadata includes specialty info)
    if (context.specialty && module.metadata) {
      const moduleSpecialties = (module.metadata as any).specialties || [];
      if (moduleSpecialties.includes(context.specialty)) {
        matchFactors.specialtyMatch = 0.3;
        score += 0.3;
        reasons.push(`Matches your specialty: ${context.specialty}`);
      }
    }

    // 2. Region match (if module is region-specific)
    if (context.region && module.metadata) {
      const moduleRegions = (module.metadata as any).regions || [];
      if (moduleRegions.includes(context.region)) {
        matchFactors.regionMatch = 0.2;
        score += 0.2;
        reasons.push(`Available in your region: ${context.region}`);
      }
    }

    // 3. Previous marketplace activity match
    if (context.orgId) {
      const activityScore = await this.calculateActivityMatch(moduleId, context.orgId);
      if (activityScore > 0) {
        matchFactors.activityMatch = activityScore;
        score += activityScore;
        reasons.push('Matches your organization\'s marketplace activity patterns');
      }
    }

    // 4. Trending modules boost
    const trendingBoost = await this.calculateTrendingBoost(moduleId);
    if (trendingBoost > 0) {
      matchFactors.trendingBoost = trendingBoost;
      score += trendingBoost;
      reasons.push('Currently trending in the marketplace');
    }

    // 5. Rating boost (if module has good ratings)
    if (module.averageRating && module.averageRating >= 4.0 && module.ratingCount >= 5) {
      score += 0.1;
      reasons.push(`Highly rated (${module.averageRating.toFixed(1)}/5.0)`);
    }

    // Normalize score to 0-1 range
    score = Math.min(score, 1.0);

    return { score, reasons, matchFactors };
  }

  /**
   * Calculate activity match score based on similar modules purchased
   */
  private async calculateActivityMatch(
    moduleId: string,
    orgId: string
  ): Promise<number> {
    // Get organization's purchase history
    const purchases = await prisma.marketplacePurchase.findMany({
      where: {
        orgId,
        status: 'completed',
      },
      include: {
        listing: true,
      },
    });

    if (purchases.length === 0) {
      return 0;
    }

    // Get current module details
    const currentModule = await prisma.marketplaceModule.findUnique({
      where: { id: moduleId },
    });

    if (!currentModule) {
      return 0;
    }

    // Check if organization has purchased similar modules
    // (e.g., same vendor, similar capabilities, same product type)
    const similarPurchases = purchases.filter((p) => {
      const listing = p.listing;
      // Match by product type
      if (listing.productType === 'module') {
        // Could check for similar capabilities or vendor
        return true;
      }
      return false;
    });

    // Score based on similarity (simple heuristic)
    if (similarPurchases.length > 0) {
      return Math.min(0.2, similarPurchases.length * 0.05);
    }

    return 0;
  }

  /**
   * Calculate trending boost based on recent search and purchase activity
   */
  private async calculateTrendingBoost(moduleId: string): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get recent search queries mentioning this module
    const recentSearches = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint as count
      FROM "SearchQuery"
      WHERE query ILIKE ${`%${moduleId}%`}
        OR query ILIKE ${`%${(await prisma.marketplaceModule.findUnique({ where: { id: moduleId } }))?.name || ''}%`}
      AND timestamp >= ${sevenDaysAgo}
    `;

    // Get recent purchases
    const recentPurchases = await prisma.marketplacePurchase.count({
      where: {
        listing: {
          productType: 'module',
          metadata: {
            path: ['moduleId'],
            equals: moduleId,
          },
        },
        createdAt: {
          gte: sevenDaysAgo,
        },
        status: 'completed',
      },
    });

    const searchCount = Number(recentSearches[0]?.count || 0);
    const purchaseCount = recentPurchases;

    // Boost score based on activity (normalized)
    if (searchCount > 10 || purchaseCount > 5) {
      return 0.15;
    } else if (searchCount > 5 || purchaseCount > 2) {
      return 0.1;
    } else if (searchCount > 0 || purchaseCount > 0) {
      return 0.05;
    }

    return 0;
  }

  /**
   * Update daily recommendations (to be called by a scheduled job)
   */
  async updateDailyRecommendations(): Promise<void> {
    // This would typically pre-compute recommendations for all active users/orgs
    // and store them in a cache or database table for fast retrieval
    // For now, we'll just log that the update would happen
    console.log('[ModuleRecommendationEngine] Daily recommendations update triggered');

    // In production, you might:
    // 1. Get all active organizations
    // 2. Pre-compute recommendations for each
    // 3. Store in a RecommendationCache table
    // 4. Invalidate old recommendations
  }
}

// Export singleton instance
export const moduleRecommendationEngine = new ModuleRecommendationEngine();

