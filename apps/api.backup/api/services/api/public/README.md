# Public API Service

This service provides a public-facing GraphQL API for third-party developers to access Chai VC Platform data.

## Features

- **GraphQL API**: Comprehensive GraphQL schema covering providers, credentials, modules, contracts, and community posts
- **Authentication**: Supports API keys and OAuth tokens with scope-based authorization
- **Rate Limiting**: Per-API-key rate limiting with Redis-backed storage
- **API Versioning**: Version management via URL path and headers with deprecation warnings
- **Batch Loading**: DataLoader integration to prevent N+1 query problems
- **Data Privacy**: Only public fields are exposed, sensitive data is filtered out

## Components

### Schema (`schema.graphql`)
Defines the public GraphQL schema with types for:
- Providers
- Credentials
- Organizations
- Modules
- Contract Templates
- Community Posts

### Authentication (`authMiddleware.ts`)
- API key authentication via `Authorization: Bearer <key>` or `X-API-Key` header
- OAuth token support
- Scope-based authorization (`requireScopes`, `requireAnyScope`)

### Rate Limiting (`rateLimitService.ts`)
- Per-API-key rate limits (configurable per minute/hour)
- Route-specific limits
- Redis-backed or in-memory storage
- Rate limit headers in responses

### API Versioning (`apiVersioning.ts`)
- Version extraction from URL path (`/api/public/v1/...`)
- Version extraction from headers (`Accept: application/vnd.chai-vc.v1+json`)
- Deprecation warnings for deprecated versions
- Sunset date support

### Resolvers
- **CredentialQueryResolver**: Query credentials by ID, provider NPI, specialty, type, status
- **OrganizationSearchResolver**: Search organizations with integration to SearchIndexService

### Batch Loaders (`utils/graphqlBatchLoader.ts`)
DataLoader instances for:
- Credentials
- Organizations
- Modules
- Contract Templates
- Community Posts
- Credentials by Provider NPI

## Usage

### Setting up the API

```typescript
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApolloServer } from 'apollo-server-express';
import { readFileSync } from 'fs';
import { authenticatePublicAPI, requireScopes, API_SCOPES } from './authMiddleware';
import { rateLimitService } from './rateLimitService';
import { apiVersionMiddleware } from './apiVersioning';
import { createLoaders } from './utils/graphqlBatchLoader';
import { credentialResolvers } from './resolvers/credentialQueryResolver';
import { organizationSearchResolvers } from './resolvers/organizationSearchResolver';

const prisma = new PrismaClient();
const schema = readFileSync('./schema.graphql', 'utf-8');

const server = new ApolloServer({
  typeDefs: schema,
  resolvers: {
    Query: {
      ...credentialResolvers.Query,
      ...organizationSearchResolvers.Query,
    },
  },
  context: ({ req }) => {
    const loaders = createLoaders(prisma);
    return {
      prisma,
      loaders,
      req,
    };
  },
});

const app: Express = /* your Express app */;

// Apply middleware
app.use('/api/public', apiVersionMiddleware);
app.use('/api/public', authenticatePublicAPI(prisma));
app.use('/api/public', rateLimitService.middleware());

await server.start();
server.applyMiddleware({ app, path: '/api/public/v1/graphql' });
```

### Using the Client Library

```typescript
import { createClient } from '@chai-vc/public-api-client';

const client = createClient({
  baseUrl: 'https://api.chaivc.com',
  apiKey: 'your-api-key',
  version: 'v1',
});

// Query credentials
const credentials = await client.searchCredentials({
  providerNpi: '1234567890',
  pagination: { limit: 20 },
});

// Search organizations
const orgs = await client.searchOrganizations({
  query: 'hospital',
  region: 'CA',
  pagination: { limit: 10 },
});
```

## Environment Variables

- `PUBLIC_API_RATE_LIMIT_PER_MINUTE`: Global rate limit per minute (default: 100)
- `PUBLIC_API_RATE_LIMIT_PER_HOUR`: Global rate limit per hour (default: 1000)
- `REDIS_URL`: Redis connection URL for rate limiting (optional, falls back to in-memory)

## Testing

Run integration tests:

```bash
npm test -- services/api/public/tests/integration.test.ts
```

Tests cover:
- Authentication (API keys, OAuth tokens)
- Rate limiting
- GraphQL queries
- Data privacy (no sensitive data leaks)
- API versioning
- Error handling

## Deployment

See `infra/api/publicApiGateway.tf` for Terraform configuration to deploy behind AWS API Gateway with:
- WAF protection
- Rate limiting
- CORS configuration
- TLS/SSL
- CloudWatch monitoring

## Security Considerations

1. **API Keys**: Store API keys securely, hash them in the database
2. **Rate Limiting**: Configure appropriate limits based on your usage patterns
3. **Scopes**: Use fine-grained scopes to limit access
4. **Data Privacy**: Always filter sensitive fields in resolvers
5. **Input Validation**: Validate all GraphQL inputs
6. **Error Messages**: Don't leak sensitive information in error messages

## Future Enhancements

- Webhook support for real-time updates
- GraphQL subscriptions
- Additional query filters
- Advanced search capabilities
- API analytics dashboard

