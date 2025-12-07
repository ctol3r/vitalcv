/**
 * B227A-DEV-001: Developer Portal GraphQL Schema and Resolvers
 */

import { gql } from 'apollo-server-express';
import { PrismaClient } from '@prisma/client';
import { DeveloperPortalService } from '../../../services/developer/portalService';
import { ModuleUploadHandler } from '../../../services/developer/moduleUploadHandler';
import { verifyApiKey } from '../../../services/developer/models/DeveloperApiKeys';

export const developerTypeDefs = gql`
  type DeveloperProfile {
    vendorId: String!
    did: String
    name: String!
    contactInfo: JSON
    kycStatus: String!
    reputationScore: Float!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type ApiKey {
    id: ID!
    createdAt: DateTime!
    lastUsedAt: DateTime
    revoked: Boolean!
  }

  type ApiKeyWithKey {
    id: ID!
    key: String!
    createdAt: DateTime!
  }

  type Module {
    id: ID!
    name: String!
    version: String!
    approvalStatus: String!
    createdAt: DateTime!
  }

  type UploadResult {
    stagingId: String!
    moduleId: String
    status: String!
    scanResults: JSON
    approvalResults: JSON
    error: String
  }

  type Query {
    developerProfile(vendorId: String): DeveloperProfile
    developerProfileByDid(did: String!): DeveloperProfile
    apiKeys: [ApiKey!]!
  }

  type Mutation {
    registerDeveloper(
      vendorId: String!
      did: String
      name: String!
      contactInfo: JSON
    ): RegisterDeveloperResult!

    updateDeveloperProfile(
      name: String
      did: String
      contactInfo: JSON
    ): DeveloperProfile!

    generateApiKey: ApiKeyWithKey!

    revokeApiKey(id: ID!): Boolean!

    submitModule(
      name: String!
      version: String!
      description: String!
      capabilities: [String!]!
      price: Float
      currency: String
      licenseType: String
    ): Module!
  }

  type RegisterDeveloperResult {
    profile: DeveloperProfile!
    apiKey: ApiKeyWithKey!
  }

  scalar DateTime
  scalar JSON
`;

export const createDeveloperResolvers = (prisma: PrismaClient) => {
  const portalService = new DeveloperPortalService(prisma);
  const uploadHandler = new ModuleUploadHandler(prisma);

  return {
    Query: {
      developerProfile: async (
        _parent: unknown,
        args: { vendorId?: string },
        context: { prisma: PrismaClient; apiKey?: string }
      ) => {
        const vendorId = args.vendorId || (context.apiKey ? await verifyApiKey(prisma, context.apiKey!) : null);
        if (!vendorId) {
          throw new Error('vendorId required or valid API key');
        }
        return portalService.getDeveloperProfile(vendorId);
      },

      developerProfileByDid: async (
        _parent: unknown,
        args: { did: string },
        _context: { prisma: PrismaClient }
      ) => {
        return portalService.getDeveloperProfileByDid(args.did);
      },

      apiKeys: async (
        _parent: unknown,
        _args: unknown,
        context: { prisma: PrismaClient; apiKey?: string }
      ) => {
        if (!context.apiKey) {
          throw new Error('API key required');
        }
        const developerId = await verifyApiKey(prisma, context.apiKey);
        if (!developerId) {
          throw new Error('Invalid API key');
        }
        return portalService.listApiKeys(developerId);
      },
    },

    Mutation: {
      registerDeveloper: async (
        _parent: unknown,
        args: {
          vendorId: string;
          did?: string;
          name: string;
          contactInfo?: any;
        },
        _context: { prisma: PrismaClient }
      ) => {
        return portalService.registerDeveloper({
          vendorId: args.vendorId,
          did: args.did,
          name: args.name,
          contactInfo: args.contactInfo,
        });
      },

      updateDeveloperProfile: async (
        _parent: unknown,
        args: {
          name?: string;
          did?: string;
          contactInfo?: any;
        },
        context: { prisma: PrismaClient; apiKey?: string }
      ) => {
        if (!context.apiKey) {
          throw new Error('API key required');
        }
        const developerId = await verifyApiKey(prisma, context.apiKey);
        if (!developerId) {
          throw new Error('Invalid API key');
        }
        return portalService.updateDeveloperProfile(developerId, {
          name: args.name,
          did: args.did,
          contactInfo: args.contactInfo,
        });
      },

      generateApiKey: async (
        _parent: unknown,
        _args: unknown,
        context: { prisma: PrismaClient; apiKey?: string }
      ) => {
        if (!context.apiKey) {
          throw new Error('API key required');
        }
        const developerId = await verifyApiKey(prisma, context.apiKey);
        if (!developerId) {
          throw new Error('Invalid API key');
        }
        return portalService.generateApiKey(developerId);
      },

      revokeApiKey: async (
        _parent: unknown,
        args: { id: string },
        context: { prisma: PrismaClient; apiKey?: string }
      ) => {
        if (!context.apiKey) {
          throw new Error('API key required');
        }
        await verifyApiKey(prisma, context.apiKey);
        await portalService.revokeApiKey(args.id);
        return true;
      },

      submitModule: async (
        _parent: unknown,
        args: {
          name: string;
          version: string;
          description: string;
          capabilities: string[];
          price?: number;
          currency?: string;
          licenseType?: string;
        },
        context: { prisma: PrismaClient; apiKey?: string }
      ) => {
        if (!context.apiKey) {
          throw new Error('API key required');
        }
        const developerId = await verifyApiKey(prisma, context.apiKey);
        if (!developerId) {
          throw new Error('Invalid API key');
        }
        return portalService.submitModule({
          name: args.name,
          version: args.version,
          description: args.description,
          vendorId: developerId,
          capabilities: args.capabilities,
          price: args.price || 0,
          currency: args.currency || 'USD',
          licenseType: (args.licenseType as any) || 'SUBSCRIPTION',
        });
      },
    },
  };
};

