/**
 * B235A-API-003: CredentialQueryResolver
 *
 * Implements GraphQL resolvers for credentials queries:
 * - Fetch by id
 * - Fetch by provider
 * - Fetch by specialty
 * - Supports pagination and filtering
 * - Ensures only public fields returned
 */

import { PrismaClient } from '@prisma/client';
import { GraphQLResolveInfo } from 'graphql';

export interface PaginationInput {
  limit?: number;
  cursor?: string;
}

export interface CredentialConnection {
  items: any[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor: string | null;
    previousCursor: string | null;
  };
  totalCount: number;
}

/**
 * Convert Prisma credential to public GraphQL credential
 */
function toPublicCredential(credential: any) {
  return {
    id: credential.id,
    name: credential.name,
    issuer: credential.issuer,
    type: credential.type,
    issuedAt: credential.issuedAt.toISOString(),
    expiresAt: credential.expiresAt ? credential.expiresAt.toISOString() : null,
    status: credential.status === 'active' ? 'ACTIVE' :
            credential.status === 'revoked' ? 'REVOKED' : 'EXPIRED',
    providerNpi: credential.user?.npiClaims?.[0]?.npi || null,
  };
}

/**
 * Get credential by ID
 */
export async function getCredentialById(
  prisma: PrismaClient,
  id: string
): Promise<any | null> {
  const credential = await prisma.credential.findUnique({
    where: { id },
    include: {
      user: {
        include: {
          npiClaims: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  });

  if (!credential) {
    return null;
  }

  return toPublicCredential(credential);
}

/**
 * Get credentials with filtering and pagination
 */
export async function getCredentials(
  prisma: PrismaClient,
  args: {
    providerNpi?: string;
    specialty?: string;
    type?: string;
    status?: string;
    pagination?: PaginationInput;
  }
): Promise<CredentialConnection> {
  const limit = Math.min(args.pagination?.limit || 20, 100);
  const cursor = args.pagination?.cursor;

  // Build where clause
  const where: any = {};

  if (args.status) {
    where.status = args.status.toLowerCase();
  }

  if (args.type) {
    where.type = args.type;
  }

  // If providerNpi is specified, filter by user's NPI claim
  if (args.providerNpi) {
    where.user = {
      npiClaims: {
        some: {
          npi: args.providerNpi,
        },
      },
    };
  }

  // If specialty is specified, we'd need to join with provider specialties
  // For now, this is a placeholder - you'd need to extend the query based on your schema
  if (args.specialty) {
    // TODO: Implement specialty filtering based on your data model
    // This might require joining with Provider or NpiClaim tables
  }

  // Get total count
  const totalCount = await prisma.credential.count({ where });

  // Build query with cursor pagination
  const queryArgs: any = {
    where,
    take: limit + 1, // Take one extra to check if there's a next page
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        include: {
          npiClaims: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  };

  if (cursor) {
    queryArgs.cursor = { id: cursor };
    queryArgs.skip = 1;
  }

  const credentials = await prisma.credential.findMany(queryArgs);

  // Check if there's a next page
  const hasNextPage = credentials.length > limit;
  const items = hasNextPage ? credentials.slice(0, limit) : credentials;

  // Convert to public format
  const publicCredentials = items.map(toPublicCredential);

  return {
    items: publicCredentials,
    pageInfo: {
      hasNextPage,
      hasPreviousPage: !!cursor,
      nextCursor: hasNextPage && publicCredentials.length > 0
        ? publicCredentials[publicCredentials.length - 1].id
        : null,
      previousCursor: cursor || null,
    },
    totalCount,
  };
}

/**
 * GraphQL resolver for credential query
 */
export const credentialResolvers = {
  Query: {
    credential: async (
      _parent: any,
      args: { id: string },
      context: { prisma: PrismaClient }
    ) => {
      return getCredentialById(context.prisma, args.id);
    },

    credentials: async (
      _parent: any,
      args: {
        providerNpi?: string;
        specialty?: string;
        type?: string;
        status?: string;
        pagination?: PaginationInput;
      },
      context: { prisma: PrismaClient }
    ) => {
      return getCredentials(context.prisma, args);
    },
  },

  Credential: {
    // Field resolvers can be added here if needed
  },
};

