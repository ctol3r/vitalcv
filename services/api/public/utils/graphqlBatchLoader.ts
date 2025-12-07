/**
 * B235A-API-009: GraphQLBatchLoader
 *
 * Implements batch loading and caching for resolvers to reduce N+1 queries.
 * Integrates with DataLoader pattern.
 */

import DataLoader from 'dataloader';
import { PrismaClient } from '@prisma/client';

/**
 * Batch loader for credentials by ID
 */
export function createCredentialLoader(prisma: PrismaClient) {
  return new DataLoader<string, any>(async (ids: readonly string[]) => {
    const credentials = await prisma.credential.findMany({
      where: {
        id: { in: [...ids] },
      },
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

    // Create a map for quick lookup
    const credentialMap = new Map(credentials.map(c => [c.id, c]));

    // Return in the same order as requested IDs
    return ids.map(id => credentialMap.get(id) || null);
  });
}

/**
 * Batch loader for organizations by ID
 */
export function createOrganizationLoader(prisma: PrismaClient) {
  return new DataLoader<string, any>(async (ids: readonly string[]) => {
    const organizations = await prisma.organization.findMany({
      where: {
        id: { in: [...ids] },
      },
    });

    // Create a map for quick lookup
    const orgMap = new Map(organizations.map(o => [o.id, o]));

    // Return in the same order as requested IDs
    return ids.map(id => orgMap.get(id) || null);
  });
}

/**
 * Batch loader for modules by ID
 */
export function createModuleLoader(prisma: PrismaClient) {
  return new DataLoader<string, any>(async (ids: readonly string[]) => {
    const modules = await prisma.marketplaceModule.findMany({
      where: {
        id: { in: [...ids] },
      },
      include: {
        vendor: true,
      },
    });

    // Create a map for quick lookup
    const moduleMap = new Map(modules.map(m => [m.id, m]));

    // Return in the same order as requested IDs
    return ids.map(id => moduleMap.get(id) || null);
  });
}

/**
 * Batch loader for contract templates by ID
 */
export function createContractTemplateLoader(prisma: PrismaClient) {
  return new DataLoader<string, any>(async (ids: readonly string[]) => {
    const templates = await prisma.contractTemplate.findMany({
      where: {
        id: { in: [...ids] },
      },
    });

    // Create a map for quick lookup
    const templateMap = new Map(templates.map(t => [t.id, t]));

    // Return in the same order as requested IDs
    return ids.map(id => templateMap.get(id) || null);
  });
}

/**
 * Batch loader for community posts by ID
 */
export function createCommunityPostLoader(prisma: PrismaClient) {
  return new DataLoader<string, any>(async (ids: readonly string[]) => {
    // Try ForumPost first
    const forumPosts = await prisma.forumPost.findMany({
      where: {
        id: { in: [...ids] },
      },
      include: {
        comments: true,
        // Add reactions if you have a reactions relation
      },
    });

    // Also try Post model
    const posts = await prisma.post.findMany({
      where: {
        id: { in: [...ids] },
      },
      include: {
        comments: true,
        reactions: true,
      },
    });

    // Combine results
    const allPosts = [...forumPosts, ...posts];
    const postMap = new Map(allPosts.map(p => [p.id, p]));

    // Return in the same order as requested IDs
    return ids.map(id => postMap.get(id) || null);
  });
}

/**
 * Batch loader for credentials by provider NPI
 */
export function createCredentialsByProviderLoader(prisma: PrismaClient) {
  return new DataLoader<string, any[]>(async (npis: readonly string[]) => {
    const credentials = await prisma.credential.findMany({
      where: {
        user: {
          npiClaims: {
            some: {
              npi: { in: [...npis] },
            },
          },
        },
      },
      include: {
        user: {
          include: {
            npiClaims: true,
          },
        },
      },
    });

    // Group credentials by NPI
    const credentialsByNpi = new Map<string, any[]>();

    for (const cred of credentials) {
      const npi = cred.user?.npiClaims?.[0]?.npi;
      if (npi) {
        if (!credentialsByNpi.has(npi)) {
          credentialsByNpi.set(npi, []);
        }
        credentialsByNpi.get(npi)!.push(cred);
      }
    }

    // Return in the same order as requested NPIs
    return npis.map(npi => credentialsByNpi.get(npi) || []);
  });
}

/**
 * Create all loaders for a GraphQL context
 */
export function createLoaders(prisma: PrismaClient) {
  return {
    credential: createCredentialLoader(prisma),
    organization: createOrganizationLoader(prisma),
    module: createModuleLoader(prisma),
    contractTemplate: createContractTemplateLoader(prisma),
    communityPost: createCommunityPostLoader(prisma),
    credentialsByProvider: createCredentialsByProviderLoader(prisma),
  };
}

/**
 * Type for loaders context
 */
export type Loaders = ReturnType<typeof createLoaders>;

