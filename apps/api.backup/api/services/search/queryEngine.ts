/**
 * B232A-SEARCH-002: SearchQueryEngine
 *
 * Processes user queries, applies filters (location, specialty, credential type, status),
 * ranks results based on relevance, recency, and reputation.
 * Returns paginated results.
 */

import { SearchIndexService, IndexDocument } from './indexService.js';

export interface SearchFilters {
  location?: {
    city?: string;
    state?: string;
    zip?: string;
    radius?: number; // in miles
  };
  specialty?: string;
  credentialType?: string;
  status?: string;
  entityTypes?: IndexDocument['entityType'][];
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  metadata?: Record<string, any>;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'recency' | 'reputation';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  document: IndexDocument;
  score: number;
  highlights?: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  limit: number;
  offset: number;
  queryTime: number;
}

/**
 * SearchQueryEngine - Processes search queries with filters and ranking
 */
export class SearchQueryEngine {
  private indexService: SearchIndexService;
  private reputationService?: any; // Optional reputation service for ranking

  constructor(indexService: SearchIndexService, reputationService?: any) {
    this.indexService = indexService;
    this.reputationService = reputationService;
  }

  /**
   * Search across all entity types or specific types
   */
  async search(
    query: string,
    filters?: SearchFilters,
    options?: SearchOptions
  ): Promise<SearchResponse> {
    const startTime = Date.now();
    const entityTypes = filters?.entityTypes || ['provider', 'credential', 'module', 'contract', 'job'];
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    // Search each entity type
    const searchPromises = entityTypes.map((entityType) =>
      this.searchEntityType(query, entityType, filters, options)
    );

    const results = await Promise.all(searchPromises);
    const allResults = results.flat();

    // Apply cross-entity ranking
    const rankedResults = await this.rankResults(allResults, options);

    // Apply pagination
    const paginatedResults = rankedResults.slice(offset, offset + limit);

    return {
      results: paginatedResults,
      total: rankedResults.length,
      limit,
      offset,
      queryTime: Date.now() - startTime,
    };
  }

  /**
   * Search a specific entity type
   */
  private async searchEntityType(
    query: string,
    entityType: IndexDocument['entityType'],
    filters?: SearchFilters,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    // Access private methods via type assertion (needed for internal access)
    const indexService = this.indexService as any;
    const indexName = indexService.getIndexName(entityType);
    const client = await indexService.getClient();
    const backend = indexService.config.backend;

    // Build search query
    const searchQuery = this.buildSearchQuery(query, filters, options);

    if (backend === 'opensearch') {
      return this.searchOpenSearch(client, indexName, searchQuery, entityType);
    } else {
      return this.searchMeilisearch(client, indexName, searchQuery, entityType);
    }
  }

  /**
   * Build search query based on filters
   */
  private buildSearchQuery(query: string, filters?: SearchFilters, options?: SearchOptions): any {
    const baseQuery: any = {
      query: query,
    };

    // Add filters
    if (filters) {
      const filterConditions: any[] = [];

      if (filters.location) {
        if (filters.location.state) {
          filterConditions.push({
            term: { 'metadata.location.state': filters.location.state },
          });
        }
        if (filters.location.city) {
          filterConditions.push({
            term: { 'metadata.location.city': filters.location.city },
          });
        }
      }

      if (filters.specialty) {
        filterConditions.push({
          term: { 'metadata.specialty': filters.specialty },
        });
      }

      if (filters.credentialType) {
        filterConditions.push({
          term: { 'metadata.type': filters.credentialType },
        });
      }

      if (filters.status) {
        filterConditions.push({
          term: { 'metadata.status': filters.status },
        });
      }

      if (filters.dateRange) {
        const dateFilter: any = {
          range: {
            createdAt: {},
          },
        };
        if (filters.dateRange.from) {
          dateFilter.range.createdAt.gte = filters.dateRange.from.toISOString();
        }
        if (filters.dateRange.to) {
          dateFilter.range.createdAt.lte = filters.dateRange.to.toISOString();
        }
        filterConditions.push(dateFilter);
      }

      if (filterConditions.length > 0) {
        baseQuery.filter = filterConditions;
      }
    }

    return baseQuery;
  }

  /**
   * Search using OpenSearch
   */
  private async searchOpenSearch(
    client: any,
    indexName: string,
    searchQuery: any,
    entityType: IndexDocument['entityType']
  ): Promise<SearchResult[]> {
    const body: any = {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: searchQuery.query,
                fields: ['title^3', 'description^2', 'content'],
                type: 'best_fields',
                fuzziness: 'AUTO',
              },
            },
          ],
        },
      },
      highlight: {
        fields: {
          title: {},
          description: {},
          content: {},
        },
      },
    };

    // Add filters
    if (searchQuery.filter) {
      body.query.bool.filter = searchQuery.filter;
    }

    const response = await client.search({
      index: indexName,
      body,
      size: 100, // Get more results for cross-entity ranking
    });

    return response.body.hits.hits.map((hit: any) => ({
      document: {
        id: hit._id,
        ...hit._source,
      } as IndexDocument,
      score: hit._score,
      highlights: hit.highlight
        ? Object.values(hit.highlight).flat()
        : undefined,
    }));
  }

  /**
   * Search using Meilisearch
   */
  private async searchMeilisearch(
    client: any,
    indexName: string,
    searchQuery: any,
    entityType: IndexDocument['entityType']
  ): Promise<SearchResult[]> {
    const index = client.index(indexName);

    const searchParams: any = {
      q: searchQuery.query,
      limit: 100, // Get more results for cross-entity ranking
      attributesToHighlight: ['title', 'description', 'content'],
    };

    // Add filters
    if (searchQuery.filter) {
      const filterArray: string[] = [];
      searchQuery.filter.forEach((filter: any) => {
        if (filter.term) {
          Object.entries(filter.term).forEach(([key, value]) => {
            filterArray.push(`${key} = ${value}`);
          });
        }
      });
      if (filterArray.length > 0) {
        searchParams.filter = filterArray;
      }
    }

    const response = await index.search(searchParams.query || '', searchParams);

    return response.hits.map((hit: any) => ({
      document: {
        id: hit.id,
        ...hit,
      } as IndexDocument,
      score: hit._rankingScore || hit._score || 0,
      highlights: hit._formatted ? [hit._formatted.title, hit._formatted.description].filter(Boolean) : undefined,
    }));
  }

  /**
   * Rank results across entity types based on relevance, recency, and reputation
   */
  private async rankResults(
    results: SearchResult[],
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    const sortBy = options?.sortBy || 'relevance';
    const sortOrder = options?.sortOrder || 'desc';

    // Enhance scores with reputation if available
    if (this.reputationService && sortBy === 'reputation') {
      for (const result of results) {
        const reputationScore = await this.getReputationScore(result.document);
        result.score = result.score * 0.7 + reputationScore * 0.3;
      }
    }

    // Sort results
    results.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'relevance':
          comparison = a.score - b.score;
          break;
        case 'recency':
          comparison =
            a.document.updatedAt.getTime() - b.document.updatedAt.getTime();
          break;
        case 'reputation':
          comparison = a.score - b.score; // Already enhanced with reputation
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return results;
  }

  /**
   * Get reputation score for a document
   */
  private async getReputationScore(document: IndexDocument): Promise<number> {
    if (!this.reputationService) {
      return 0.5; // Default neutral score
    }

    try {
      // Try to get reputation based on entity type
      switch (document.entityType) {
        case 'provider':
          // Would need to fetch provider reputation
          return 0.5;
        case 'module':
          // Use averageRating from metadata
          return (document.metadata.averageRating || 0) / 5;
        case 'credential':
          // Credential reputation based on issuer
          return 0.5;
        default:
          return 0.5;
      }
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Search with autocomplete/suggestions
   */
  async suggest(query: string, limit: number = 10): Promise<string[]> {
    // This would use search backend's suggestion capabilities
    // For now, return empty array - will be implemented in SuggestionService
    return [];
  }
}

