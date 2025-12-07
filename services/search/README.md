# Search Service

**B232A-SEARCH**: Unified search service for providers, credentials, modules, contracts, and jobs.

## Overview

The Search Service provides a comprehensive search solution with:
- **SearchIndexService**: Manages search indexes with OpenSearch or Meilisearch support
- **SearchQueryEngine**: Processes queries with filters and ranking
- **SearchIngestPipeline**: Transforms data into searchable format
- **SuggestionService**: Autocomplete, spell-correction, and trending searches
- **UnifiedSearchAPI**: REST/GraphQL endpoints for unified search

## Features

- ✅ Multi-entity search (providers, credentials, modules, contracts, jobs)
- ✅ Incremental updates and full rebuilds
- ✅ OpenSearch and Meilisearch support
- ✅ Advanced filtering (location, specialty, credential type, status)
- ✅ Relevance, recency, and reputation-based ranking
- ✅ Autocomplete suggestions
- ✅ Spell correction
- ✅ Trending searches
- ✅ Search analytics and logging

## Installation

### Dependencies

Install the required search backend client:

**For OpenSearch:**
```bash
npm install @opensearch-project/opensearch
```

**For Meilisearch:**
```bash
npm install meilisearch
```

### Configuration

```typescript
import { SearchIndexService, IndexConfig } from './services/search';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const config: IndexConfig = {
  backend: 'opensearch', // or 'meilisearch'
  host: 'localhost',
  port: 9200, // 7700 for Meilisearch
  apiKey: 'your-api-key', // optional
  indexPrefix: 'chai_vc', // optional
};

const indexService = new SearchIndexService(prisma, config);
```

## Usage

### Initialize Indexes

```typescript
// Initialize all indexes
await indexService.initializeAllIndexes();

// Or create individual indexes
await indexService.createIndex('provider');
await indexService.createIndex('credential');
await indexService.createIndex('module');
await indexService.createIndex('contract');
await indexService.createIndex('job');
```

### Index Documents

```typescript
import { SearchIngestPipeline } from './services/search';

const ingestPipeline = new SearchIngestPipeline(prisma);

// Transform and index a provider
const providerDoc = await ingestPipeline.transformProvider('provider-id', {
  normalizeSynonyms: true,
  tokenizeContent: true,
  enrichWithReputation: true,
});

await indexService.indexDocument(providerDoc);

// Or index multiple documents
await indexService.indexDocuments([providerDoc, credentialDoc, moduleDoc]);
```

### Search

```typescript
import { SearchQueryEngine } from './services/search';

const queryEngine = new SearchQueryEngine(indexService);

const results = await queryEngine.search('cardiology', {
  location: { state: 'CA' },
  specialty: '207R00000X',
  entityTypes: ['provider', 'credential'],
}, {
  limit: 20,
  offset: 0,
  sortBy: 'relevance',
  sortOrder: 'desc',
});

console.log(`Found ${results.total} results in ${results.queryTime}ms`);
```

### Get Suggestions

```typescript
import { SuggestionService } from './services/search';

const suggestionService = new SuggestionService(prisma, indexService);

// Autocomplete
const suggestions = await suggestionService.getAutocompleteSuggestions('card', 10);

// Spell correction
const corrections = await suggestionService.getSpellCorrections('cardiolgy', 5);

// Trending searches
const trending = await suggestionService.getTrendingSearches(10, 'day');
```

### REST API

```typescript
import { UnifiedSearchAPI } from './services/search/api/unifiedSearchAPI';
import express from 'express';

const app = express();
const searchAPI = new UnifiedSearchAPI(prisma, config);

// Register routes
searchAPI.registerRoutes(app);

// Now available:
// POST /api/search - Unified search
// GET /api/search?q=query - Search with query string
// GET /api/search/suggestions?q=prefix - Autocomplete
// GET /api/search/spellcheck?q=query - Spell correction
// GET /api/search/trending - Trending searches
// POST /api/search/index/rebuild - Rebuild index (admin)
// GET /api/search/index/stats - Index statistics
```

### Example API Requests

**Search:**
```bash
curl -X POST http://localhost:4000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "cardiology",
    "filters": {
      "location": { "state": "CA" },
      "specialty": "207R00000X"
    },
    "options": {
      "limit": 20,
      "sortBy": "relevance"
    }
  }'
```

**Autocomplete:**
```bash
curl "http://localhost:4000/api/search/suggestions?q=card&limit=10"
```

**Trending:**
```bash
curl "http://localhost:4000/api/search/trending?limit=10&window=day"
```

## Index Management

### Rebuild Index

```typescript
// Full rebuild (deletes and recreates index)
await indexService.rebuildIndex('provider');
```

### Update Document

```typescript
// Incremental update
const doc = await ingestPipeline.transformProvider('provider-id');
await indexService.updateDocument(doc);
```

### Delete Document

```typescript
await indexService.deleteDocument('provider', 'provider-id');
```

### Get Statistics

```typescript
const stats = await indexService.getIndexStats('provider');
console.log(`Total documents: ${stats.totalDocuments}`);
```

## Data Transformation

The `SearchIngestPipeline` transforms data with:

- **Synonym normalization**: Maps synonyms to canonical terms
- **Tokenization**: Removes stop words and normalizes text
- **Reputation enrichment**: Adds reputation scores when available
- **Marketplace enrichment**: Adds marketplace data for modules

```typescript
const doc = await ingestPipeline.transformModule('module-id', {
  normalizeSynonyms: true,
  tokenizeContent: true,
  enrichWithMarketplace: true,
});
```

## Search Filters

Supported filters:

- **location**: `{ city?, state?, zip?, radius? }`
- **specialty**: Specialty code (e.g., "207R00000X")
- **credentialType**: Credential type (e.g., "license", "certification")
- **status**: Entity status (e.g., "active", "expired")
- **entityTypes**: Array of entity types to search
- **dateRange**: `{ from?: Date, to?: Date }`
- **metadata**: Custom metadata filters

## Ranking

Results are ranked by:

1. **Relevance**: Text match score from search backend
2. **Recency**: Document update timestamp
3. **Reputation**: Reputation score (when available)

Sort options:
- `relevance` (default)
- `recency`
- `reputation`

## Architecture

```
┌─────────────────────────────────────────┐
│      UnifiedSearchAPI (REST/GraphQL)    │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌──────▼──────────┐
│QueryEngine  │  │SuggestionService│
└──────┬──────┘  └─────────────────┘
       │
┌──────▼──────────┐
│ SearchIndexService│
│ (OpenSearch/     │
│  Meilisearch)   │
└─────────────────┘
       │
┌──────▼──────────┐
│IngestPipeline   │
│ (Data Transform) │
└─────────────────┘
```

## Entity Types

- **provider**: PECOSProvider records
- **credential**: Credential records
- **module**: MarketplaceModule records
- **contract**: PartnerContract records
- **job**: JobPosting records

## Notes

- Indexes are created lazily on first use
- Search backends are initialized asynchronously
- Search logs are kept in memory (consider persisting for production)
- Reputation integration requires reputation service
- Marketplace enrichment requires marketplace module data

## Future Enhancements

- [ ] Persistent search log storage
- [ ] Advanced analytics dashboard
- [ ] Custom ranking algorithms
- [ ] Multi-language support
- [ ] Faceted search
- [ ] Search result caching

