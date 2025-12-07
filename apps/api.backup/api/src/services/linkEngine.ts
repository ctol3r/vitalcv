import { PrismaClient } from '@prisma/client';
import MiniSearch from 'minisearch';

const prisma = new PrismaClient();

// MiniSearch index for text similarity
const search = new MiniSearch({
  fields: ['name', 'description'],
  storeFields: ['id', 'type'],
});

// Cache flag to track if index is loaded
let indexLoaded = false;

/**
 * Build or rebuild the search index from all entities
 */
export async function buildIndex() {
  try {
    // Clear existing index
    search.removeAll();

    // Get all entities from the database
    const entities = await prisma.entity.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        text: true,
        tags: true,
      },
    });

    // Add to search index
    search.addAll(
      entities.map((e) => ({
        id: e.id,
        name: e.name,
        text: e.text || '',
        type: e.type,
        tags: e.tags,
      })),
    );

    indexLoaded = true;
    console.log(`Built search index with ${entities.length} entities`);
    return true;
  } catch (error) {
    console.error('Error building search index:', error);
    return false;
  }
}

/**
 * Infer links between entities based on text similarity
 * @param entityId - The entity to find links for
 * @param text - The text content to search against
 * @returns Array of inferred links
 */
export async function inferLinks(entityId: string, text: string) {
  if (!indexLoaded) {
    await buildIndex();
  }

  try {
    // Search for similar entities
    const results = search
      .search(text, {
        prefix: true,
        fuzzy: 0.2,
      })
      .slice(0, 5);

    // Create bi-directional links
    const linksToCreate = [];
    for (const result of results) {
      const linkData = {
        sourceId: entityId,
        targetId: result.id as string,
        score: result.score || 0.8,
        createdAt: new Date(),
      };

      // Add both directions (A->B and B->A)
      linksToCreate.push(linkData);
      linksToCreate.push({
        sourceId: result.id as string,
        targetId: entityId,
        score: result.score || 0.8,
        createdAt: new Date(),
      });
    }

    // Store in database (skip duplicates due to unique constraint)
    await prisma.link.createMany({
      data: linksToCreate,
      skipDuplicates: true,
    });

    return linksToCreate.filter((_, idx) => idx % 2 === 0); // Return only source->target direction
  } catch (error) {
    console.error('Error inferring links:', error);
    return [];
  }
}

/**
 * Get all links for an entity (both inbound and outbound)
 * @param entityId - The entity ID to get links for
 * @returns Array of links
 */
export async function getLinks(entityId: string) {
  try {
    return await prisma.link.findMany({
      where: {
        OR: [{ sourceId: entityId }, { targetId: entityId }],
      },
      orderBy: {
        score: 'desc',
      },
    });
  } catch (error) {
    console.error('Error getting links:', error);
    return [];
  }
}

/**
 * Get recent links across all entities
 * @param limit - Maximum number of links to return
 * @returns Array of recent links
 */
export async function getRecentLinks(limit: number = 10) {
  try {
    return await prisma.link.findMany({
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });
  } catch (error) {
    console.error('Error getting recent links:', error);
    return [];
  }
}
