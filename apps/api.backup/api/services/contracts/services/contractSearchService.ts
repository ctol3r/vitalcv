/**
 * B251B-CON-017: ContractSearchService
 *
 * Indexes contracts into search index (title, type, status, parties, tags);
 * supports search query with filters; returns paginated results.
 */

import { PrismaClient, ContractStatus, ContractType } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';

const prisma = new PrismaClient();
const log = getServiceLogger('contracts/search');

export interface SearchQuery {
  query?: string; // Full-text search
  status?: ContractStatus | ContractStatus[];
  type?: ContractType | ContractType[];
  authorId?: string;
  partyId?: string; // Search by party (organizationId or partnerId)
  tags?: string[];
  effectiveDateFrom?: Date;
  effectiveDateTo?: Date;
  expirationDateFrom?: Date;
  expirationDateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  contracts: any[];
  total: number;
  limit: number;
  offset: number;
}

export class ContractSearchService {
  /**
   * Index a contract for search
   * In production, this would update a search index (Elasticsearch, Algolia, etc.)
   * For now, we'll use database queries with full-text search
   */
  async indexContract(contractId: string): Promise<void> {
    log.info('Indexing contract', { contractId });

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        parties: true,
        tagMappings: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    // In production, you would:
    // 1. Extract searchable text (title, type, status, party names, tags)
    // 2. Index into Elasticsearch/Algolia/etc.
    // 3. Store searchable metadata

    // For now, we'll just log it
    log.info('Contract indexed', {
      contractId,
      title: contract.title,
      type: contract.type,
      status: contract.status,
    });
  }

  /**
   * Search contracts with query and filters
   */
  async search(query: SearchQuery): Promise<SearchResult> {
    log.info('Searching contracts', { query: query.query });

    const where: any = {};

    // Full-text search on title
    if (query.query) {
      where.title = {
        contains: query.query,
        mode: 'insensitive',
      };
    }

    // Status filter
    if (query.status) {
      if (Array.isArray(query.status)) {
        where.status = { in: query.status };
      } else {
        where.status = query.status;
      }
    }

    // Type filter
    if (query.type) {
      if (Array.isArray(query.type)) {
        where.type = { in: query.type };
      } else {
        where.type = query.type;
      }
    }

    // Author filter
    if (query.authorId) {
      where.authorId = query.authorId;
    }

    // Party filter
    if (query.partyId) {
      where.parties = {
        some: {
          OR: [
            { organizationId: query.partyId },
            { partnerId: query.partyId },
          ],
        },
      };
    }

    // Date range filters
    if (query.effectiveDateFrom || query.effectiveDateTo) {
      where.effectiveDate = {};
      if (query.effectiveDateFrom) {
        where.effectiveDate.gte = query.effectiveDateFrom;
      }
      if (query.effectiveDateTo) {
        where.effectiveDate.lte = query.effectiveDateTo;
      }
    }

    if (query.expirationDateFrom || query.expirationDateTo) {
      where.expirationDate = {};
      if (query.expirationDateFrom) {
        where.expirationDate.gte = query.expirationDateFrom;
      }
      if (query.expirationDateTo) {
        where.expirationDate.lte = query.expirationDateTo;
      }
    }

    // Tags filter
    if (query.tags && query.tags.length > 0) {
      where.tagMappings = {
        some: {
          tag: {
            slug: { in: query.tags },
          },
        },
      };
    }

    const limit = Math.min(query.limit || 50, 100);
    const offset = query.offset || 0;

    // Execute search
    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        include: {
          currentVersion: {
            select: {
              versionNumber: true,
              content: false, // Don't include full content in search results
            },
          },
          parties: {
            select: {
              id: true,
              contactName: true,
              contactEmail: true,
              role: true,
              signatureStatus: true,
            },
          },
          tagMappings: {
            include: {
              tag: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.contract.count({ where }),
    ]);

    log.info('Search completed', {
      query: query.query,
      total,
      returned: contracts.length,
    });

    return {
      contracts,
      total,
      limit,
      offset,
    };
  }

  /**
   * Re-index all contracts
   */
  async reindexAll(): Promise<void> {
    log.info('Re-indexing all contracts');

    const contracts = await prisma.contract.findMany({
      select: { id: true },
    });

    for (const contract of contracts) {
      await this.indexContract(contract.id);
    }

    log.info('Re-indexing completed', { count: contracts.length });
  }

  /**
   * Remove contract from search index
   */
  async removeFromIndex(contractId: string): Promise<void> {
    log.info('Removing contract from index', { contractId });

    // In production, remove from search index
    // For now, just log it
    log.info('Contract removed from index', { contractId });
  }
}

// Export singleton instance
export const contractSearchService = new ContractSearchService();

