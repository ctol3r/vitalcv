/**
 * B232A-SEARCH-005: UnifiedSearch API
 *
 * Exposes REST/GraphQL endpoints for unified search across all entity types.
 * Supports filters, sorting, and access control.
 * Returns results grouped by entity.
 */

import { Express, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { SearchIndexService, IndexConfig } from '../indexService.js';
import { SearchQueryEngine, SearchFilters, SearchOptions } from '../queryEngine.js';
import { SearchIngestPipeline } from '../ingestPipeline.js';
import { SuggestionService } from '../suggestionService.js';

export interface UnifiedSearchRequest {
  query: string;
  filters?: SearchFilters;
  options?: SearchOptions;
}

export interface UnifiedSearchResponse {
  results: {
    providers: any[];
    credentials: any[];
    modules: any[];
    contracts: any[];
    jobs: any[];
  };
  total: number;
  queryTime: number;
  suggestions?: string[];
}

/**
 * UnifiedSearchAPI - REST and GraphQL API for unified search
 */
export class UnifiedSearchAPI {
  private indexService: SearchIndexService;
  private queryEngine: SearchQueryEngine;
  private ingestPipeline: SearchIngestPipeline;
  private suggestionService: SuggestionService;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient, config: IndexConfig) {
    this.prisma = prisma;
    this.indexService = new SearchIndexService(prisma, config);
    this.queryEngine = new SearchQueryEngine(this.indexService);
    this.ingestPipeline = new SearchIngestPipeline(prisma);
    this.suggestionService = new SuggestionService(prisma, this.indexService);
  }

  /**
   * Register REST routes
   */
  registerRoutes(app: Express): void {
    // Unified search endpoint
    app.post('/api/search', this.handleSearch.bind(this));
    app.get('/api/search', this.handleSearchGet.bind(this));

    // Autocomplete suggestions
    app.get('/api/search/suggestions', this.handleSuggestions.bind(this));

    // Spell correction
    app.get('/api/search/spellcheck', this.handleSpellCheck.bind(this));

    // Trending searches
    app.get('/api/search/trending', this.handleTrending.bind(this));

    // Index management (admin only)
    app.post('/api/search/index/rebuild', this.handleRebuildIndex.bind(this));
    app.post('/api/search/index/update', this.handleUpdateIndex.bind(this));
    app.get('/api/search/index/stats', this.handleIndexStats.bind(this));
  }

  /**
   * Handle POST search request
   */
  private async handleSearch(req: Request, res: Response): Promise<void> {
    try {
      const { query, filters, options } = req.body as UnifiedSearchRequest;

      if (!query || query.trim().length === 0) {
        res.status(400).json({ error: 'Query is required' });
        return;
      }

      // Check access control
      const hasAccess = await this.checkAccess(req);
      if (!hasAccess) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Perform search
      const searchResponse = await this.queryEngine.search(query, filters, options);

      // Group results by entity type
      const grouped = this.groupResultsByEntity(searchResponse.results);

      // Log search
      await this.suggestionService.logSearch({
        query,
        entityType: filters?.entityTypes?.[0],
        filters: filters as any,
        resultCount: searchResponse.total,
        timestamp: new Date(),
        userId: (req as any).user?.id,
      });

      // Get suggestions if query is short
      let suggestions: string[] | undefined;
      if (query.length < 10) {
        const suggestionResults = await this.suggestionService.getAutocompleteSuggestions(
          query,
          5
        );
        suggestions = suggestionResults.map((s) => s.text);
      }

      const response: UnifiedSearchResponse = {
        results: grouped,
        total: searchResponse.total,
        queryTime: searchResponse.queryTime,
        suggestions,
      };

      res.json(response);
    } catch (error: any) {
      console.error('Search error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Handle GET search request (query string)
   */
  private async handleSearchGet(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      if (!query) {
        res.status(400).json({ error: 'Query parameter "q" is required' });
        return;
      }

      const filters: SearchFilters = {};
      if (req.query.location) {
        filters.location = { state: req.query.location as string };
      }
      if (req.query.specialty) {
        filters.specialty = req.query.specialty as string;
      }
      if (req.query.credentialType) {
        filters.credentialType = req.query.credentialType as string;
      }
      if (req.query.status) {
        filters.status = req.query.status as string;
      }

      const options: SearchOptions = {
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
        sortBy: (req.query.sortBy as any) || 'relevance',
        sortOrder: (req.query.sortOrder as any) || 'desc',
      };

      const searchResponse = await this.queryEngine.search(query, filters, options);
      const grouped = this.groupResultsByEntity(searchResponse.results);

      await this.suggestionService.logSearch({
        query,
        filters: filters as any,
        resultCount: searchResponse.total,
        timestamp: new Date(),
        userId: (req as any).user?.id,
      });

      res.json({
        results: grouped,
        total: searchResponse.total,
        queryTime: searchResponse.queryTime,
      });
    } catch (error: any) {
      console.error('Search error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Handle autocomplete suggestions
   */
  private async handleSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const prefix = req.query.q as string;
      if (!prefix) {
        res.status(400).json({ error: 'Query parameter "q" is required' });
        return;
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const entityType = req.query.entityType as string | undefined;

      const suggestions = await this.suggestionService.getAutocompleteSuggestions(
        prefix,
        limit,
        entityType as any
      );

      res.json({
        suggestions: suggestions.map((s) => ({
          text: s.text,
          score: s.score,
          type: s.type,
        })),
      });
    } catch (error: any) {
      console.error('Suggestions error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Handle spell check
   */
  private async handleSpellCheck(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      if (!query) {
        res.status(400).json({ error: 'Query parameter "q" is required' });
        return;
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const corrections = await this.suggestionService.getSpellCorrections(query, limit);

      res.json({
        query,
        corrections: corrections.map((c) => ({
          text: c.text,
          score: c.score,
        })),
      });
    } catch (error: any) {
      console.error('Spell check error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Handle trending searches
   */
  private async handleTrending(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const timeWindow = (req.query.window as 'hour' | 'day' | 'week') || 'day';

      const trending = await this.suggestionService.getTrendingSearches(limit, timeWindow);

      res.json({
        trending: trending.map((t) => ({
          query: t.text,
          score: t.score,
        })),
      });
    } catch (error: any) {
      console.error('Trending searches error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Handle index rebuild (admin only)
   */
  private async handleRebuildIndex(req: Request, res: Response): Promise<void> {
    try {
      // Check admin access
      if (!this.isAdmin(req)) {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const entityType = req.body.entityType as string;
      if (!entityType) {
        res.status(400).json({ error: 'entityType is required' });
        return;
      }

      await this.indexService.rebuildIndex(entityType as any);

      res.json({
        message: `Index rebuilt for ${entityType}`,
        timestamp: new Date(),
      });
    } catch (error: any) {
      console.error('Rebuild index error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Handle index update (incremental)
   */
  private async handleUpdateIndex(req: Request, res: Response): Promise<void> {
    try {
      // Check admin access
      if (!this.isAdmin(req)) {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const { entityType, entityId } = req.body;
      if (!entityType || !entityId) {
        res.status(400).json({ error: 'entityType and entityId are required' });
        return;
      }

      const document = await this.ingestPipeline[`transform${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`](
        entityId
      );

      await this.indexService.indexDocument(document);

      res.json({
        message: `Index updated for ${entityType}:${entityId}`,
        timestamp: new Date(),
      });
    } catch (error: any) {
      console.error('Update index error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Handle index statistics
   */
  private async handleIndexStats(req: Request, res: Response): Promise<void> {
    try {
      const entityType = req.query.entityType as string | undefined;

      if (entityType) {
        const stats = await this.indexService.getIndexStats(entityType as any);
        res.json({ [entityType]: stats });
      } else {
        const entityTypes = ['provider', 'credential', 'module', 'contract', 'job'];
        const allStats: Record<string, any> = {};

        for (const type of entityTypes) {
          allStats[type] = await this.indexService.getIndexStats(type as any);
        }

        res.json(allStats);
      }
    } catch (error: any) {
      console.error('Index stats error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Group search results by entity type
   */
  private groupResultsByEntity(results: any[]): UnifiedSearchResponse['results'] {
    const grouped = {
      providers: [] as any[],
      credentials: [] as any[],
      modules: [] as any[],
      contracts: [] as any[],
      jobs: [] as any[],
    };

    for (const result of results) {
      const entityType = result.document.entityType;
      switch (entityType) {
        case 'provider':
          grouped.providers.push(result.document);
          break;
        case 'credential':
          grouped.credentials.push(result.document);
          break;
        case 'module':
          grouped.modules.push(result.document);
          break;
        case 'contract':
          grouped.contracts.push(result.document);
          break;
        case 'job':
          grouped.jobs.push(result.document);
          break;
      }
    }

    return grouped;
  }

  /**
   * Check if user has access to search
   */
  private async checkAccess(req: Request): Promise<boolean> {
    // Implement access control logic
    // For now, allow all authenticated users
    return !!(req as any).user;
  }

  /**
   * Check if user is admin
   */
  private isAdmin(req: Request): boolean {
    const user = (req as any).user;
    return user?.roles?.includes('admin') || false;
  }

  /**
   * Get GraphQL schema
   */
  getGraphQLSchema(): string {
    return `
      type SearchResult {
        id: ID!
        entityType: String!
        title: String!
        description: String
        score: Float!
        metadata: JSON
      }

      type SearchResults {
        providers: [SearchResult!]!
        credentials: [SearchResult!]!
        modules: [SearchResult!]!
        contracts: [SearchResult!]!
        jobs: [SearchResult!]!
        total: Int!
        queryTime: Int!
      }

      input SearchFilters {
        location: LocationFilter
        specialty: String
        credentialType: String
        status: String
        entityTypes: [String!]
      }

      input LocationFilter {
        city: String
        state: String
        zip: String
        radius: Int
      }

      input SearchOptions {
        limit: Int
        offset: Int
        sortBy: String
        sortOrder: String
      }

      type Query {
        search(
          query: String!
          filters: SearchFilters
          options: SearchOptions
        ): SearchResults!

        searchSuggestions(prefix: String!, limit: Int, entityType: String): [String!]!
        spellCheck(query: String!): [String!]!
        trendingSearches(limit: Int, window: String): [String!]!
      }
    `;
  }
}

