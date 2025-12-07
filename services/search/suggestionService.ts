/**
 * B232A-SEARCH-004: SuggestionService
 *
 * Provides auto-complete and spell-correction suggestions.
 * Tracks trending searches.
 * Uses search logs for training suggestions.
 */

import { PrismaClient } from '@prisma/client';
import { SearchIndexService } from './indexService.js';

export interface Suggestion {
  text: string;
  score: number;
  type: 'autocomplete' | 'spellcorrection' | 'trending';
}

export interface SearchLog {
  query: string;
  entityType?: string;
  filters?: Record<string, any>;
  resultCount: number;
  timestamp: Date;
  userId?: string;
}

/**
 * SuggestionService - Provides search suggestions and tracks trends
 */
export class SuggestionService {
  private prisma: PrismaClient;
  private indexService: SearchIndexService;
  private searchLogs: SearchLog[] = [];
  private trendingQueries: Map<string, number> = new Map();
  private queryFrequency: Map<string, number> = new Map();

  constructor(prisma: PrismaClient, indexService: SearchIndexService) {
    this.prisma = prisma;
    this.indexService = indexService;
    this.loadTrendingQueries();
  }

  /**
   * Get autocomplete suggestions for a query prefix
   */
  async getAutocompleteSuggestions(
    prefix: string,
    limit: number = 10,
    entityType?: string
  ): Promise<Suggestion[]> {
    const indexService = this.indexService as any;
    const client = await indexService.getClient();
    const backend = indexService.config.backend;
    const suggestions: Suggestion[] = [];

    // Get suggestions from search backend
    if (backend === 'opensearch') {
      const autocompleteSuggestions = await this.getOpenSearchSuggestions(
        client,
        prefix,
        limit,
        entityType
      );
      suggestions.push(...autocompleteSuggestions);
    } else {
      const autocompleteSuggestions = await this.getMeilisearchSuggestions(
        client,
        prefix,
        limit,
        entityType
      );
      suggestions.push(...autocompleteSuggestions);
    }

    // Add trending queries that match prefix
    const trendingMatches = this.getTrendingMatches(prefix, limit);
    suggestions.push(...trendingMatches);

    // Add frequent queries that match prefix
    const frequentMatches = this.getFrequentMatches(prefix, limit);
    suggestions.push(...frequentMatches);

    // Deduplicate and sort by score
    const unique = this.deduplicateSuggestions(suggestions);
    return unique.slice(0, limit);
  }

  /**
   * Get spell correction suggestions for a query
   */
  async getSpellCorrections(query: string, limit: number = 5): Promise<Suggestion[]> {
    const client = this.indexService['client'];
    const backend = this.indexService['config'].backend;
    const suggestions: Suggestion[] = [];

    if (backend === 'opensearch') {
      const corrections = await this.getOpenSearchSpellCorrections(client, query, limit);
      suggestions.push(...corrections);
    } else {
      const corrections = await this.getMeilisearchSpellCorrections(client, query, limit);
      suggestions.push(...corrections);
    }

    // Add common misspellings
    const commonCorrections = this.getCommonMisspellings(query);
    suggestions.push(...commonCorrections);

    return this.deduplicateSuggestions(suggestions).slice(0, limit);
  }

  /**
   * Get trending searches
   */
  async getTrendingSearches(limit: number = 10, timeWindow?: 'hour' | 'day' | 'week'): Promise<Suggestion[]> {
    const window = timeWindow || 'day';
    const cutoff = this.getTimeWindowCutoff(window);

    const trending = Array.from(this.trendingQueries.entries())
      .filter(([_, timestamp]) => timestamp >= cutoff)
      .map(([query, count]) => ({
        text: query,
        score: count,
        type: 'trending' as const,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return trending;
  }

  /**
   * Log a search query for analytics and training
   */
  async logSearch(log: SearchLog): Promise<void> {
    this.searchLogs.push(log);

    // Update trending queries
    const key = `${log.query}:${log.entityType || 'all'}`;
    const currentCount = this.trendingQueries.get(key) || 0;
    this.trendingQueries.set(key, currentCount + 1);

    // Update query frequency
    const freq = this.queryFrequency.get(log.query) || 0;
    this.queryFrequency.set(log.query, freq + 1);

    // Persist to database (async, non-blocking)
    this.persistSearchLog(log).catch((error) => {
      console.error('Failed to persist search log:', error);
    });

    // Cleanup old logs periodically
    if (this.searchLogs.length > 10000) {
      this.searchLogs = this.searchLogs.slice(-5000);
    }
  }

  /**
   * Get OpenSearch autocomplete suggestions
   */
  private async getOpenSearchSuggestions(
    client: any,
    prefix: string,
    limit: number,
    entityType?: string
  ): Promise<Suggestion[]> {
    try {
      const indexService = this.indexService as any;
      const indices = entityType
        ? [indexService.getIndexName(entityType as any)]
        : [
            'chai_vc_provider',
            'chai_vc_credential',
            'chai_vc_module',
            'chai_vc_contract',
            'chai_vc_job',
          ];

      const body = {
        suggest: {
          autocomplete: {
            prefix,
            completion: {
              field: 'title',
              size: limit,
            },
          },
        },
      };

      const response = await client.search({
        index: indices.join(','),
        body,
      });

      const suggestions: Suggestion[] = [];
      if (response.body.suggest?.autocomplete) {
        for (const option of response.body.suggest.autocomplete[0]?.options || []) {
          suggestions.push({
            text: option.text,
            score: option.score || 0.5,
            type: 'autocomplete',
          });
        }
      }

      return suggestions;
    } catch (error) {
      console.error('OpenSearch suggestion error:', error);
      return [];
    }
  }

  /**
   * Get Meilisearch autocomplete suggestions
   */
  private async getMeilisearchSuggestions(
    client: any,
    prefix: string,
    limit: number,
    entityType?: string
  ): Promise<Suggestion[]> {
    try {
      const indexService = this.indexService as any;
      const indexName = entityType
        ? indexService.getIndexName(entityType as any)
        : 'chai_vc_all';

      const index = client.index(indexName);
      const response = await index.search(prefix, {
        limit,
        attributesToRetrieve: ['title'],
      });

      // If index doesn't exist, return empty
      if (!response) {
        return [];
      }

      return response.hits.map((hit: any) => ({
        text: hit.title,
        score: hit._rankingScore || 0.5,
        type: 'autocomplete',
      }));
    } catch (error) {
      console.error('Meilisearch suggestion error:', error);
      return [];
    }
  }

  /**
   * Get OpenSearch spell corrections
   */
  private async getOpenSearchSpellCorrections(
    client: any,
    query: string,
    limit: number
  ): Promise<Suggestion[]> {
    try {
      const body = {
        suggest: {
          spellcheck: {
            text: query,
            term: {
              field: 'content',
              prefix_length: 1,
              min_word_length: 3,
            },
          },
        },
      };

      const response = await client.search({
        index: '_all',
        body,
      });

      const suggestions: Suggestion[] = [];
      if (response.body.suggest?.spellcheck) {
        for (const term of response.body.suggest.spellcheck[0]?.options || []) {
          suggestions.push({
            text: term.text,
            score: term.score || 0.7,
            type: 'spellcorrection',
          });
        }
      }

      return suggestions;
    } catch (error) {
      console.error('OpenSearch spell correction error:', error);
      return [];
    }
  }

  /**
   * Get Meilisearch spell corrections
   */
  private async getMeilisearchSpellCorrections(
    client: any,
    query: string,
    limit: number
  ): Promise<Suggestion[]> {
    try {
      // Meilisearch has built-in typo tolerance
      // We can use the search API with typo tolerance
      // Note: This is a simplified implementation
      // In production, you'd use Meilisearch's typo tolerance features
      const indexService = this.indexService as any;
      const indexName = 'chai_vc_all';
      const index = client.index(indexName);
      const response = await index.search(query, {
        limit: 1,
        typoTolerance: true,
      });

      // If results are found with typos, suggest the corrected query
      if (response.hits.length > 0) {
        return [
          {
            text: query, // Meilisearch handles typos internally
            score: 0.8,
            type: 'spellcorrection',
          },
        ];
      }

      return [];
    } catch (error) {
      console.error('Meilisearch spell correction error:', error);
      return [];
    }
  }

  /**
   * Get trending matches for a prefix
   */
  private getTrendingMatches(prefix: string, limit: number): Suggestion[] {
    const lowerPrefix = prefix.toLowerCase();
    return Array.from(this.trendingQueries.entries())
      .filter(([query]) => query.toLowerCase().startsWith(lowerPrefix))
      .map(([query, count]) => ({
        text: query,
        score: count / 100, // Normalize score
        type: 'trending' as const,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get frequent query matches for a prefix
   */
  private getFrequentMatches(prefix: string, limit: number): Suggestion[] {
    const lowerPrefix = prefix.toLowerCase();
    return Array.from(this.queryFrequency.entries())
      .filter(([query]) => query.toLowerCase().startsWith(lowerPrefix))
      .map(([query, freq]) => ({
        text: query,
        score: Math.log(freq + 1) / 10, // Logarithmic scoring
        type: 'autocomplete' as const,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get common misspellings corrections
   */
  private getCommonMisspellings(query: string): Suggestion[] {
    const commonCorrections: Record<string, string> = {
      'cardiolgy': 'cardiology',
      'orthapedics': 'orthopedics',
      'pediatics': 'pediatrics',
      'psycology': 'psychology',
      'licence': 'license',
      'certifaction': 'certification',
      'credentialing': 'credential',
    };

    const lowerQuery = query.toLowerCase();
    const suggestions: Suggestion[] = [];

    for (const [misspelling, correction] of Object.entries(commonCorrections)) {
      if (lowerQuery.includes(misspelling)) {
        const corrected = query.replace(new RegExp(misspelling, 'gi'), correction);
        suggestions.push({
          text: corrected,
          score: 0.9,
          type: 'spellcorrection',
        });
      }
    }

    return suggestions;
  }

  /**
   * Deduplicate suggestions by text
   */
  private deduplicateSuggestions(suggestions: Suggestion[]): Suggestion[] {
    const seen = new Set<string>();
    const unique: Suggestion[] = [];

    for (const suggestion of suggestions) {
      const key = suggestion.text.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(suggestion);
      } else {
        // Merge scores for duplicates
        const existing = unique.find((s) => s.text.toLowerCase() === key);
        if (existing) {
          existing.score = Math.max(existing.score, suggestion.score);
        }
      }
    }

    return unique.sort((a, b) => b.score - a.score);
  }

  /**
   * Get time window cutoff timestamp
   */
  private getTimeWindowCutoff(window: 'hour' | 'day' | 'week'): number {
    const now = Date.now();
    const msPerHour = 60 * 60 * 1000;
    const msPerDay = msPerHour * 24;
    const msPerWeek = msPerDay * 7;

    switch (window) {
      case 'hour':
        return now - msPerHour;
      case 'day':
        return now - msPerDay;
      case 'week':
        return now - msPerWeek;
      default:
        return now - msPerDay;
    }
  }

  /**
   * Load trending queries from database
   */
  private async loadTrendingQueries(): Promise<void> {
    try {
      // This would load from a SearchLog table if it exists
      // For now, initialize empty
      this.trendingQueries = new Map();
      this.queryFrequency = new Map();
    } catch (error) {
      console.error('Failed to load trending queries:', error);
    }
  }

  /**
   * Persist search log to database
   */
  private async persistSearchLog(log: SearchLog): Promise<void> {
    // This would save to a SearchLog table
    // For now, just keep in memory
    // In production, you'd want to batch insert these
  }
}

