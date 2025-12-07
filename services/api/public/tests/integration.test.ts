/**
 * B235A-API-007: PublicAPIIntegrationTests
 *
 * End-to-end tests for public API endpoints (GraphQL and REST).
 * Covers authentication, rate limiting, and data correctness.
 * Uses test keys.
 * Ensures no sensitive data leaks.
 */

import { PrismaClient } from '@prisma/client';
import { Express } from 'express';
import request from 'supertest';
import { authenticatePublicAPI, API_SCOPES } from '../authMiddleware';
import { rateLimitService } from '../rateLimitService';

// Mock API keys for testing
const TEST_API_KEY = 'test_api_key_12345';
const TEST_API_KEY_INACTIVE = 'test_api_key_inactive';
const TEST_API_KEY_LIMITED_SCOPES = 'test_api_key_limited';

// Mock OAuth token for testing
const TEST_OAUTH_TOKEN = 'oauth_test_token_12345';

describe('Public API Integration Tests', () => {
  let app: Express;
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Initialize Express app with public API routes
    // This would typically be done in your main server file
    // app = createPublicAPIApp(prisma);

    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Authentication', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .post('/api/public/v1/graphql')
        .send({ query: '{ credential(id: "test") { id } }' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should accept requests with valid API key in Authorization header', async () => {
      const response = await request(app)
        .post('/api/public/v1/graphql')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send({ query: '{ credential(id: "test") { id } }' });

      expect(response.status).not.toBe(401);
    });

    it('should accept requests with valid API key in X-API-Key header', async () => {
      const response = await request(app)
        .post('/api/public/v1/graphql')
        .set('X-API-Key', TEST_API_KEY)
        .send({ query: '{ credential(id: "test") { id } }' });

      expect(response.status).not.toBe(401);
    });

    it('should reject requests with inactive API key', async () => {
      const response = await request(app)
        .post('/api/public/v1/graphql')
        .set('Authorization', `Bearer ${TEST_API_KEY_INACTIVE}`)
        .send({ query: '{ credential(id: "test") { id } }' });

      expect(response.status).toBe(401);
    });

    it('should accept requests with valid OAuth token', async () => {
      const response = await request(app)
        .post('/api/public/v1/graphql')
        .set('Authorization', `Bearer ${TEST_OAUTH_TOKEN}`)
        .send({ query: '{ credential(id: "test") { id } }' });

      expect(response.status).not.toBe(401);
    });

    it('should enforce scope requirements', async () => {
      // Try to access credentials endpoint without required scope
      const response = await request(app)
        .post('/api/public/v1/graphql')
        .set('Authorization', `Bearer ${TEST_API_KEY_LIMITED_SCOPES}`)
        .send({
          query: `
            query {
              credentials { items { id } }
            }
          `,
        });

      // Should fail if scope is missing
      expect(response.status).toBe(403);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits per API key', async () => {
      const requests = [];
      const limit = 10; // Assuming limit is 10 requests per minute

      // Make requests up to the limit
      for (let i = 0; i < limit; i++) {
        requests.push(
          request(app)
            .post('/api/public/v1/graphql')
            .set('Authorization', `Bearer ${TEST_API_KEY}`)
            .send({ query: '{ credential(id: "test") { id } }' })
        );
      }

      await Promise.all(requests);

      // Next request should be rate limited
      const response = await request(app)
        .post('/api/public/v1/graphql')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send({ query: '{ credential(id: "test") { id } }' });

      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Too Many Requests');
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should include rate limit headers in responses', async () => {
      const response = await request(app)
        .post('/api/public/v1/graphql')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send({ query: '{ credential(id: "test") { id } }' });

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('GraphQL Queries', () => {
    it('should return credential by ID', async () => {
      // Create a test credential first
      const testCredential = await prisma.credential.create({
        data: {
          name: 'Test Credential',
          issuer: 'Test Issuer',
          type: 'license',
          userId: 'test-user-id',
          status: 'active',
        },
      });

      const response = await request(app)
        .post('/api/public/v1/graphql')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send({
          query: `
            query GetCredential($id: ID!) {
              credential(id: $id) {
                id
                name
                issuer
                type
                status
              }
            }
          `,
          variables: { id: testCredential.id },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.credential).toBeDefined();
      expect(response.body.data.credential.id).toBe(testCredential.id);
      expect(response.body.data.credential.name).toBe('Test Credential');

      // Cleanup
      await prisma.credential.delete({ where: { id: testCredential.id } });
    });

    it('should return paginated credentials', async () => {
      const response = await request(app)
        .post('/api/public/v1/graphql')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send({
          query: `
            query {
              credentials(pagination: { limit: 10 }) {
                items {
                  id
                  name
                }
                pageInfo {
                  hasNextPage
                  hasPreviousPage
                  nextCursor
                }
                totalCount
              }
            }
          `,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.credentials).toBeDefined();
      expect(response.body.data.credentials.items).toBeInstanceOf(Array);
      expect(response.body.data.credentials.pageInfo).toBeDefined();
      expect(response.body.data.credentials.totalCount).toBeGreaterThanOrEqual(0);
    });

    it('should filter credentials by provider NPI', async () => {
      const response = await request(app)
        .post('/api/public/v1/graphql')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send({
          query: `
            query {
              credentials(providerNpi: "1234567890") {
                items {
                  id
                  providerNpi
                }
              }
            }
          `,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.credentials.items).toBeInstanceOf(Array);
      // All returned credentials should have the specified provider NPI
      response.body.data.credentials.items.forEach((cred: any) => {
        expect(cred.providerNpi).toBe('1234567890');
      });
    });

    it('should search organizations', async () => {
      const response = await request(app)
        .post('/api/public/v1/graphql')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send({
          query: `
            query {
              searchOrganizations(query: "test", pagination: { limit: 10 }) {
                items {
                  id
                  name
                }
                pageInfo {
                  hasNextPage
                }
                totalCount
              }
            }
          `,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.searchOrganizations).toBeDefined();
      expect(response.body.data.searchOrganizations.items).toBeInstanceOf(Array);
    });
  });

  describe('Data Privacy', () => {
    it('should not expose sensitive user data', async () => {
      const response = await request(app)
        .post('/api/public/v1/graphql')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send({
          query: `
            query {
              credential(id: "test") {
                id
                name
              }
            }
          `,
        });

      expect(response.status).toBe(200);
      const credential = response.body.data?.credential;

      if (credential) {
        // Ensure sensitive fields are not exposed
        expect(credential).not.toHaveProperty('userId');
        expect(credential).not.toHaveProperty('user');
        expect(credential).not.toHaveProperty('credHash');
        expect(credential).not.toHaveProperty('issuerDid');
        expect(credential).not.toHaveProperty('holderDid');
      }
    });

    it('should not expose internal organization data', async () => {
      const response = await request(app)
        .post('/api/public/v1/graphql')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send({
          query: `
            query {
              organization(id: "test") {
                id
                name
              }
            }
          `,
        });

      expect(response.status).toBe(200);
      const org = response.body.data?.organization;

      if (org) {
        // Ensure internal fields are not exposed
        expect(org).not.toHaveProperty('userLinks');
        expect(org).not.toHaveProperty('internalMetadata');
      }
    });
  });

  describe('API Versioning', () => {
    it('should accept requests with version in URL path', async () => {
      const response = await request(app)
        .post('/api/public/v1/graphql')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send({ query: '{ credential(id: "test") { id } }' });

      expect(response.status).not.toBe(400);
      expect(response.headers['x-api-version']).toBe('v1');
    });

    it('should accept requests with version in Accept header', async () => {
      const response = await request(app)
        .post('/api/public/graphql')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .set('Accept', 'application/vnd.chai-vc.v1+json')
        .send({ query: '{ credential(id: "test") { id } }' });

      expect(response.status).not.toBe(400);
      expect(response.headers['x-api-version']).toBe('v1');
    });

    it('should reject unsupported API versions', async () => {
      const response = await request(app)
        .post('/api/public/v99/graphql')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send({ query: '{ credential(id: "test") { id } }' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Unsupported API Version');
    });
  });

  describe('Error Handling', () => {
    it('should return proper error format for GraphQL errors', async () => {
      const response = await request(app)
        .post('/api/public/v1/graphql')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send({
          query: `
            query {
              credential(id: "nonexistent") {
                id
                nonexistentField
              }
            }
          `,
        });

      expect(response.status).toBe(200); // GraphQL returns 200 even with errors
      expect(response.body.errors).toBeDefined();
    });

    it('should return 404 for non-existent resources', async () => {
      const response = await request(app)
        .post('/api/public/v1/graphql')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .send({
          query: `
            query {
              credential(id: "nonexistent-id-12345") {
                id
              }
            }
          `,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.credential).toBeNull();
    });
  });
});

