// B235B-API-015: PartnerManagement GraphQL resolver

import { PrismaClient } from '@prisma/client';
import { APIKeyManagementService } from '../apiKeyService';
import { APIQuotaService, QuotaStatus } from '../apiQuotaService';
import { PublicAPIUsageTracker, EndpointStats, TopConsumer } from '../usageTracker';
import { gql } from 'apollo-server-express';

export const partnerManagementTypeDefs = gql`
  type APIKey {
    id: ID!
    keyPrefix: String!
    ownerOrgId: String!
    scopes: [String!]!
    status: APIKeyStatus!
    createdAt: String!
    lastUsedAt: String
    metadata: JSON
  }

  type APIKeyWithPlaintext {
    id: ID!
    key: String!
    keyPrefix: String!
    ownerOrgId: String!
    scopes: [String!]!
    status: APIKeyStatus!
    createdAt: String!
    lastUsedAt: String
    metadata: JSON
  }

  enum APIKeyStatus {
    ACTIVE
    REVOKED
  }

  type QuotaStatus {
    quotaType: String!
    limit: Int!
    currentUsage: Int!
    remaining: Int!
    resetAt: String!
    isExceeded: Boolean!
    percentageUsed: Float!
  }

  type EndpointStats {
    endpoint: String!
    method: String!
    requestCount: Int!
    avgLatencyMs: Float!
    errorRate: Float!
    totalDataTransferBytes: Int!
  }

  type TopConsumer {
    apiKeyId: String!
    keyPrefix: String!
    requestCount: Int!
    dataTransferBytes: Int!
  }

  type UsageMetrics {
    endpointStats: [EndpointStats!]!
    topConsumers: [TopConsumer!]!
    totalRequests: Int!
    totalDataTransferBytes: Int!
    errorRate: Float!
  }

  input CreateAPIKeyInput {
    ownerOrgId: ID!
    scopes: [String!]!
    metadata: JSON
  }

  input QuotaConfigInput {
    requests: Int
    dataTransfer: Int
    specialOperations: Int
    periodDays: Int
  }

  type Query {
    # Get API keys for current organization
    myAPIKeys: [APIKey!]!

    # Get API key by ID
    apiKey(id: ID!): APIKey

    # Get quota status for an API key
    apiKeyQuotas(apiKeyId: ID!): [QuotaStatus!]!

    # Get usage metrics
    usageMetrics(
      apiKeyId: ID
      startDate: String!
      endDate: String!
    ): UsageMetrics!

    # Get endpoint statistics
    endpointStats(
      apiKeyId: ID
      startDate: String!
      endDate: String!
    ): [EndpointStats!]!

    # Get top consumers
    topConsumers(
      startDate: String!
      endDate: String!
      limit: Int
    ): [TopConsumer!]!
  }

  type Mutation {
    # Create a new API key
    createAPIKey(input: CreateAPIKeyInput!): APIKeyWithPlaintext!

    # Rotate an API key
    rotateAPIKey(apiKeyId: ID!): APIKeyWithPlaintext!

    # Revoke an API key
    revokeAPIKey(apiKeyId: ID!, reason: String): Boolean!

    # Reactivate a revoked API key
    reactivateAPIKey(apiKeyId: ID!): APIKey!

    # Initialize quotas for an API key
    initializeQuotas(apiKeyId: ID!, config: QuotaConfigInput!): Boolean!
  }
`;

interface Context {
  prisma: PrismaClient;
  userId?: string;
  orgId?: string;
  isOrgAdmin?: boolean;
}

export function createPartnerManagementResolvers(
  apiKeyService: APIKeyManagementService,
  quotaService: APIQuotaService,
  usageTracker: PublicAPIUsageTracker
) {
  return {
    Query: {
      myAPIKeys: async (_parent: unknown, _args: unknown, context: Context) => {
        // Enforce RBAC: user must be authenticated and belong to org
        if (!context.userId || !context.orgId) {
          throw new Error('Unauthorized: Must be authenticated');
        }

        // Check if user belongs to organization
        const userOrgLink = await context.prisma.userOrgLink.findFirst({
          where: {
            userId: context.userId,
            orgId: context.orgId,
          },
        });

        if (!userOrgLink) {
          throw new Error('Unauthorized: User does not belong to organization');
        }

        return apiKeyService.listAPIKeys(context.orgId);
      },

      apiKey: async (
        _parent: unknown,
        args: { id: string },
        context: Context
      ) => {
        if (!context.userId || !context.orgId) {
          throw new Error('Unauthorized');
        }

        const apiKey = await apiKeyService.getAPIKeyById(args.id);
        if (!apiKey) {
          return null;
        }

        // Verify ownership
        if (apiKey.ownerOrgId !== context.orgId) {
          throw new Error('Unauthorized: API key does not belong to your organization');
        }

        return apiKey;
      },

      apiKeyQuotas: async (
        _parent: unknown,
        args: { apiKeyId: string },
        context: Context
      ) => {
        if (!context.userId || !context.orgId) {
          throw new Error('Unauthorized');
        }

        // Verify ownership
        const apiKey = await apiKeyService.getAPIKeyById(args.apiKeyId);
        if (!apiKey || apiKey.ownerOrgId !== context.orgId) {
          throw new Error('Unauthorized: API key does not belong to your organization');
        }

        return quotaService.getQuotaStatus(args.apiKeyId);
      },

      usageMetrics: async (
        _parent: unknown,
        args: {
          apiKeyId?: string;
          startDate: string;
          endDate: string;
        },
        context: Context
      ) => {
        if (!context.userId || !context.orgId) {
          throw new Error('Unauthorized');
        }

        // If apiKeyId provided, verify ownership
        if (args.apiKeyId) {
          const apiKey = await apiKeyService.getAPIKeyById(args.apiKeyId);
          if (!apiKey || apiKey.ownerOrgId !== context.orgId) {
            throw new Error('Unauthorized: API key does not belong to your organization');
          }
        }

        const startDate = new Date(args.startDate);
        const endDate = new Date(args.endDate);

        const [endpointStats, topConsumers] = await Promise.all([
          usageTracker.getEndpointStats(startDate, endDate, args.apiKeyId),
          usageTracker.getTopConsumers(startDate, endDate, 10),
        ]);

        // Calculate totals
        const totalRequests = endpointStats.reduce(
          (sum, stat) => sum + stat.requestCount,
          0
        );
        const totalDataTransferBytes = endpointStats.reduce(
          (sum, stat) => sum + stat.totalDataTransferBytes,
          0
        );
        const totalErrors = endpointStats.reduce(
          (sum, stat) => sum + (stat.errorRate / 100) * stat.requestCount,
          0
        );
        const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

        return {
          endpointStats,
          topConsumers,
          totalRequests,
          totalDataTransferBytes,
          errorRate,
        };
      },

      endpointStats: async (
        _parent: unknown,
        args: {
          apiKeyId?: string;
          startDate: string;
          endDate: string;
        },
        context: Context
      ) => {
        if (!context.userId || !context.orgId) {
          throw new Error('Unauthorized');
        }

        if (args.apiKeyId) {
          const apiKey = await apiKeyService.getAPIKeyById(args.apiKeyId);
          if (!apiKey || apiKey.ownerOrgId !== context.orgId) {
            throw new Error('Unauthorized');
          }
        }

        return usageTracker.getEndpointStats(
          new Date(args.startDate),
          new Date(args.endDate),
          args.apiKeyId
        );
      },

      topConsumers: async (
        _parent: unknown,
        args: {
          startDate: string;
          endDate: string;
          limit?: number;
        },
        context: Context
      ) => {
        // Only org admins can see top consumers across all keys
        if (!context.userId || !context.orgId || !context.isOrgAdmin) {
          throw new Error('Unauthorized: Organization admin access required');
        }

        return usageTracker.getTopConsumers(
          new Date(args.startDate),
          new Date(args.endDate),
          args.limit || 10
        );
      },
    },

    Mutation: {
      createAPIKey: async (
        _parent: unknown,
        args: { input: { ownerOrgId: string; scopes: string[]; metadata?: any } },
        context: Context
      ) => {
        // Enforce RBAC: must be org admin
        if (!context.userId || !context.orgId || !context.isOrgAdmin) {
          throw new Error('Unauthorized: Organization admin access required');
        }

        // Verify org ownership
        if (args.input.ownerOrgId !== context.orgId) {
          throw new Error('Unauthorized: Cannot create API key for different organization');
        }

        return apiKeyService.createAPIKey(args.input, context.userId);
      },

      rotateAPIKey: async (
        _parent: unknown,
        args: { apiKeyId: string },
        context: Context
      ) => {
        if (!context.userId || !context.orgId || !context.isOrgAdmin) {
          throw new Error('Unauthorized: Organization admin access required');
        }

        return apiKeyService.rotateAPIKey(args.apiKeyId, context.orgId, context.userId);
      },

      revokeAPIKey: async (
        _parent: unknown,
        args: { apiKeyId: string; reason?: string },
        context: Context
      ) => {
        if (!context.userId || !context.orgId || !context.isOrgAdmin) {
          throw new Error('Unauthorized: Organization admin access required');
        }

        await apiKeyService.revokeAPIKey(
          args.apiKeyId,
          context.orgId,
          context.userId,
          args.reason
        );

        return true;
      },

      reactivateAPIKey: async (
        _parent: unknown,
        args: { apiKeyId: string },
        context: Context
      ) => {
        if (!context.userId || !context.orgId || !context.isOrgAdmin) {
          throw new Error('Unauthorized: Organization admin access required');
        }

        return apiKeyService.reactivateAPIKey(args.apiKeyId, context.orgId, context.userId);
      },

      initializeQuotas: async (
        _parent: unknown,
        args: {
          apiKeyId: string;
          config: {
            requests?: number;
            dataTransfer?: number;
            specialOperations?: number;
            periodDays?: number;
          };
        },
        context: Context
      ) => {
        if (!context.userId || !context.orgId || !context.isOrgAdmin) {
          throw new Error('Unauthorized: Organization admin access required');
        }

        // Verify ownership
        const apiKey = await apiKeyService.getAPIKeyById(args.apiKeyId);
        if (!apiKey || apiKey.ownerOrgId !== context.orgId) {
          throw new Error('Unauthorized');
        }

        await quotaService.initializeQuotas(args.apiKeyId, args.config);
        return true;
      },
    },
  };
}

