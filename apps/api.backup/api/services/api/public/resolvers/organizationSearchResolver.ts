/**
 * B235A-API-004: OrganizationSearchResolver
 *
 * Allows searching organizations by name, region, specialty via GraphQL.
 * Returns minimal public info and aggregated ratings.
 * Integrates with SearchIndexService.
 * Supports pagination.
 */

import { PrismaClient } from '@prisma/client';
import { SearchQueryEngine } from '../../../search/queryEngine';

export interface PaginationInput {
  limit?: number;
  cursor?: string;
}

export interface OrganizationConnection {
  items: any[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor: string | null;
    previousCursor: string | null;
  };
  totalCount: number;
}

/**
 * Convert Prisma organization to public GraphQL organization
 */
function toPublicOrganization(org: any, aggregatedRating?: { average: number; count: number }) {
  return {
    id: org.id,
    name: org.name,
    region: null, // TODO: Add region field to Organization model if needed
    specialty: null, // TODO: Add specialty field to Organization model if needed
    averageRating: aggregatedRating?.average || null,
    ratingCount: aggregatedRating?.count || 0,
    description: null, // TODO: Add description field if needed
  };
}

/**
 * Search organizations using SearchQueryEngine
 */
async function searchOrganizationsWithIndex(
  searchEngine: SearchQueryEngine | null,
  query: string,
  filters: {
    region?: string;
    specialty?: string;
  }
): Promise<string[]> {
  if (!searchEngine) {
    return [];
  }

  try {
    const searchFilters: any = {
      entityTypes: ['organization'],
    };

    if (filters.region) {
      searchFilters.location = { state: filters.region };
    }

    if (filters.specialty) {
      searchFilters.specialty = filters.specialty;
    }

    const results = await searchEngine.search(query, searchFilters, {
      limit: 1000, // Get more results for pagination
    });

    // Filter to only organization results and extract IDs
    return results.results
      .filter((r: any) => r.entityType === 'organization')
      .map((r: any) => r.id);
  } catch (error) {
    console.error('Search index error:', error);
    return [];
  }
}

/**
 * Get aggregated rating for organization
 * TODO: Implement based on your rating/reputation system
 */
async function getOrganizationRating(
  prisma: PrismaClient,
  orgId: string
): Promise<{ average: number; count: number } | null> {
  // Placeholder - implement based on your rating model
  // This might query a ReputationScore, Rating, or similar table
  return null;
}

/**
 * Search organizations with filtering and pagination
 */
export async function searchOrganizations(
  prisma: PrismaClient,
  searchEngine: SearchQueryEngine | null,
  args: {
    query?: string;
    region?: string;
    specialty?: string;
    pagination?: PaginationInput;
  }
): Promise<OrganizationConnection> {
  const limit = Math.min(args.pagination?.limit || 20, 100);
  const cursor = args.pagination?.cursor;

  let organizationIds: string[] = [];

  // If search query is provided, use SearchQueryEngine
  if (args.query && searchEngine) {
    organizationIds = await searchOrganizationsWithIndex(searchEngine, args.query, {
      region: args.region,
      specialty: args.specialty,
    });
  }

  // Build where clause
  const where: any = {};

  if (organizationIds.length > 0) {
    where.id = { in: organizationIds };
  }

  if (args.region) {
    // TODO: Add region filtering when Organization model has region field
  }

  if (args.specialty) {
    // TODO: Add specialty filtering when Organization model has specialty field
  }

  // Get total count
  const totalCount = await prisma.organization.count({ where });

  // Build query with cursor pagination
  const queryArgs: any = {
    where,
    take: limit + 1, // Take one extra to check if there's a next page
    orderBy: { createdAt: 'desc' },
  };

  if (cursor) {
    queryArgs.cursor = { id: cursor };
    queryArgs.skip = 1;
  }

  const organizations = await prisma.organization.findMany(queryArgs);

  // Check if there's a next page
  const hasNextPage = organizations.length > limit;
  const items = hasNextPage ? organizations.slice(0, limit) : organizations;

  // Get aggregated ratings for all organizations
  const organizationsWithRatings = await Promise.all(
    items.map(async (org) => {
      const rating = await getOrganizationRating(prisma, org.id);
      return toPublicOrganization(org, rating || undefined);
    })
  );

  return {
    items: organizationsWithRatings,
    pageInfo: {
      hasNextPage,
      hasPreviousPage: !!cursor,
      nextCursor: hasNextPage && organizationsWithRatings.length > 0
        ? organizationsWithRatings[organizationsWithRatings.length - 1].id
        : null,
      previousCursor: cursor || null,
    },
    totalCount,
  };
}

/**
 * Get organization by ID
 */
export async function getOrganizationById(
  prisma: PrismaClient,
  id: string
): Promise<any | null> {
  const org = await prisma.organization.findUnique({
    where: { id },
  });

  if (!org) {
    return null;
  }

  const rating = await getOrganizationRating(prisma, org.id);
  return toPublicOrganization(org, rating || undefined);
}

/**
 * GraphQL resolver for organization search
 */
export const organizationSearchResolvers = {
  Query: {
    organization: async (
      _parent: any,
      args: { id: string },
      context: { prisma: PrismaClient; searchService?: SearchIndexService }
    ) => {
      return getOrganizationById(context.prisma, args.id);
    },

    searchOrganizations: async (
      _parent: any,
      args: {
        query?: string;
        region?: string;
        specialty?: string;
        pagination?: PaginationInput;
      },
      context: { prisma: PrismaClient; searchEngine?: SearchQueryEngine }
    ) => {
      return searchOrganizations(
        context.prisma,
        context.searchEngine || null,
        args
      );
    },
  },

  Organization: {
    // Field resolvers can be added here if needed
  },
};

