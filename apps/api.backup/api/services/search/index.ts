/**
 * B232A-SEARCH: Search Service - Main Export
 *
 * Exports all search-related services:
 * - SearchIndexService: Index management
 * - SearchQueryEngine: Query processing and ranking
 * - SearchIngestPipeline: Data transformation
 * - SuggestionService: Autocomplete and suggestions
 * - UnifiedSearchAPI: REST/GraphQL API
 * - SearchAnalyticsTracker: Analytics tracking
 * - ModuleRecommendationEngine: Module recommendations
 * - CredentialRecommendationEngine: Credential recommendations
 * - SearchTrendReporter: Trend reporting
 * - RecommendationAPIs: Recommendation endpoints
 */

export * from './indexService.js';
export * from './queryEngine.js';
export * from './ingestPipeline.js';
export * from './suggestionService.js';
export * from './api/unifiedSearchAPI.js';
export * from './analytics/searchAnalyticsTracker.js';
export * from './analytics/searchTrendReporter.js';
export * from './recommendation/moduleRecommendationEngine.js';
export * from './recommendation/credentialRecommendationEngine.js';
export * from './api/recommendationAPI.js';

