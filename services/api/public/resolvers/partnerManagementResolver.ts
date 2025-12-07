/**
 * B235B-API-015: PartnerManagement API
 *
 * Provides GraphQL mutations and queries for partner organisations
 * to register, update, and view their API usage and keys.
 * Enforces RBAC.
 */

import { GraphQLResolveInfo } from 'graphql';
import { PrismaClient } from '@prisma/client';
import { APIKeyManagementService } from '../apiKeyService';
import { APIQuotaService } from '../apiQuotaService';
import { PublicAPIUsageTracker } from '../usageTracker';

export interface GraphQLContext {
  prisma: PrismaClient;
  userId?: string;
  orgId?: string;
  roles?: string[];
}

/**
 * Check if user has required role/permission
 */
function requireRole(context: GraphQLContext, requiredRole: string): void {
  if (!context.userId) {
    throw new Error('Authentication required');
  }

  if (!context.orgId) {
    throw new Error('Organization context required');
  }

  const userRoles = context.roles || [];
  if (!userRoles.includes(requiredRole) && !userRoles.includes('admin')) {
    throw new Error(`Insufficient permissions. Required role: ${requiredRole}`);
  }
}

/**
 * Check if user belongs to organization
 */
function requireOrgAccess(context: GraphQLContext, orgId: string): void {
  if (!context.userId) {
    throw new Error('Authentication required');
  }

  if (context.orgId !== orgId && !context.roles?.includes('admin')) {
    throw new Error('Access denied to this organization');
  }
}

export const partnerManagementResolvers = {
  Query: {
    /**
     * Get API keys for the authenticated organization
     */
    async myAPIKeys(
      _parent: any,
      _args: { includeRevoked?: boolean },
      context: GraphQLContext
    ) {
      requireRole(context, 'org_admin');
      const apiKeyService = new APIKeyManagementService(context.prisma);
      return apiKeyService.listAPIKeys(context.orgId!, _args.includeRevoked);
    },

    /**
     * Get a specific API key
     */
    async apiKey(
      _parent: any,
      args: { id: string },
      context: GraphQLContext
    ) {
      requireRole(context, 'org_admin');
      const apiKeyService = new APIKeyManagementService(context.prisma);
      const apiKey = await apiKeyService.getAPIKey(args.id);

      if (apiKey) {
        requireOrgAccess(context, apiKey.ownerOrgId);
      }

      return apiKey;
    },

    /**
     * Get API usage statistics
     */
    async apiUsageStats(
      _parent: any,
      args: {
        startDate?: string;
        endDate?: string;
        apiKeyId?: string;
      },
      context: GraphQLContext
    ) {
      requireRole(context, 'org_admin');
      const usageTracker = new PublicAPIUsageTracker(context.prisma);

      const startDate = args.startDate ? new Date(args.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = args.endDate ? new Date(args.endDate) : new Date();

      return usageTracker.getUsageMetrics(startDate, endDate, {
        apiKeyId: args.apiKeyId,
      });
    },

    /**
     * Get quota status for API keys
     */
    async apiQuotaStatus(
      _parent: any,
      args: { apiKeyId: string },
      context: GraphQLContext
    ) {
      requireRole(context, 'org_admin');
      const apiKeyService = new APIKeyManagementService(context.prisma);
      const apiKey = await apiKeyService.getAPIKey(args.apiKeyId);

      if (apiKey) {
        requireOrgAccess(context, apiKey.ownerOrgId);
      }

      const quotaService = new APIQuotaService(context.prisma);
      return quotaService.getQuotaStatus(args.apiKeyId);
    },

    /**
     * Get usage statistics for an API key
     */
    async apiKeyUsageStats(
      _parent: any,
      args: { apiKeyId: string },
      context: GraphQLContext
    ) {
      requireRole(context, 'org_admin');
      const apiKeyService = new APIKeyManagementService(context.prisma);
      const apiKey = await apiKeyService.getAPIKey(args.apiKeyId);

      if (apiKey) {
        requireOrgAccess(context, apiKey.ownerOrgId);
      }

      const quotaService = new APIQuotaService(context.prisma);
      return quotaService.getUsageStats(args.apiKeyId);
    },
  },

  Mutation: {
    /**
     * Create a new API key
     */
    async createAPIKey(
      _parent: any,
      args: {
        scopes: string[];
        name?: string;
        description?: string;
      },
      context: GraphQLContext
    ) {
      requireRole(context, 'org_admin');
      const apiKeyService = new APIKeyManagementService(context.prisma);

      return apiKeyService.createAPIKey({
        ownerOrgId: context.orgId!,
        scopes: args.scopes,
        name: args.name,
        description: args.description,
      });
    },

    /**
     * Rotate an API key
     */
    async rotateAPIKey(
      _parent: any,
      args: {
        keyId: string;
        revokeOld?: boolean;
      },
      context: GraphQLContext
    ) {
      requireRole(context, 'org_admin');
      const apiKeyService = new APIKeyManagementService(context.prisma);
      const apiKey = await apiKeyService.getAPIKey(args.keyId);

      if (apiKey) {
        requireOrgAccess(context, apiKey.ownerOrgId);
      }

      return apiKeyService.rotateAPIKey(args.keyId, args.revokeOld ?? true);
    },

    /**
     * Revoke an API key
     */
    async revokeAPIKey(
      _parent: any,
      args: {
        keyId: string;
        reason?: string;
      },
      context: GraphQLContext
    ) {
      requireRole(context, 'org_admin');
      const apiKeyService = new APIKeyManagementService(context.prisma);
      const apiKey = await apiKeyService.getAPIKey(args.keyId);

      if (apiKey) {
        requireOrgAccess(context, apiKey.ownerOrgId);
      }

      await apiKeyService.revokeAPIKey(args.keyId, args.reason);
      return { success: true, message: 'API key revoked successfully' };
    },

    /**
     * Reactivate a revoked API key
     */
    async reactivateAPIKey(
      _parent: any,
      args: { keyId: string },
      context: GraphQLContext
    ) {
      requireRole(context, 'org_admin');
      const apiKeyService = new APIKeyManagementService(context.prisma);
      const apiKey = await apiKeyService.getAPIKey(args.keyId);

      if (apiKey) {
        requireOrgAccess(context, apiKey.ownerOrgId);
      }

      await apiKeyService.reactivateAPIKey(args.keyId);
      return { success: true, message: 'API key reactivated successfully' };
    },

    /**
     * Update API key scopes
     */
    async updateAPIKeyScopes(
      _parent: any,
      args: {
        keyId: string;
        scopes: string[];
      },
      context: GraphQLContext
    ) {
      requireRole(context, 'org_admin');
      const apiKeyService = new APIKeyManagementService(context.prisma);
      const apiKey = await apiKeyService.getAPIKey(args.keyId);

      if (apiKey) {
        requireOrgAccess(context, apiKey.ownerOrgId);
      }

      await apiKeyService.updateScopes(args.keyId, args.scopes);
      return { success: true, message: 'Scopes updated successfully' };
    },
  },
};

