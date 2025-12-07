/**
 * B232A-SEARCH-001: SearchIndexService
 *
 * Creates and manages search indexes for providers, credentials, modules, contracts, and jobs.
 * Supports incremental updates and full rebuilds.
 * Uses OpenSearch or Meilisearch as the search backend.
 */

import { PrismaClient } from '@prisma/client';

export type SearchBackend = 'opensearch' | 'meilisearch';

export interface IndexConfig {
  backend: SearchBackend;
  host: string;
  port?: number;
  apiKey?: string;
  indexPrefix?: string;
}

export interface IndexDocument {
  id: string;
  entityType: 'provider' | 'credential' | 'module' | 'contract' | 'job';
  title: string;
  description?: string;
  content: string; // Full-text searchable content
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IndexStats {
  totalDocuments: number;
  lastIndexedAt: Date | null;
  indexSize: number;
}

/**
 * SearchIndexService - Manages search indexes for all entity types
 */
export class SearchIndexService {
  private config: IndexConfig;
  private prisma: PrismaClient;
  private client: any; // OpenSearch or Meilisearch client
  private clientPromise: Promise<any> | null = null;

  constructor(prisma: PrismaClient, config: IndexConfig) {
    this.prisma = prisma;
    this.config = config;
    this.clientPromise = this.initializeClient();
  }

  /**
   * Get the initialized client (lazy initialization)
   */
  private async getClient(): Promise<any> {
    if (!this.client) {
      this.client = await this.clientPromise;
    }
    return this.client;
  }

  /**
   * Initialize the search backend client
   */
  private async initializeClient(): Promise<any> {
    if (this.config.backend === 'opensearch') {
      // OpenSearch client initialization
      try {
        const { Client } = await import('@opensearch-project/opensearch');
        return new Client({
          node: `http://${this.config.host}:${this.config.port || 9200}`,
          ...(this.config.apiKey && {
            auth: {
              username: 'admin',
              password: this.config.apiKey,
            },
          }),
        });
      } catch (error) {
        throw new Error('OpenSearch client not available. Install @opensearch-project/opensearch');
      }
    } else {
      // Meilisearch client initialization
      try {
        const { MeiliSearch } = await import('meilisearch');
        return new MeiliSearch({
          host: `http://${this.config.host}:${this.config.port || 7700}`,
          apiKey: this.config.apiKey,
        });
      } catch (error) {
        throw new Error('Meilisearch client not available. Install meilisearch');
      }
    }
  }

  /**
   * Get index name for an entity type
   */
  private getIndexName(entityType: IndexDocument['entityType']): string {
    const prefix = this.config.indexPrefix || 'chai_vc';
    return `${prefix}_${entityType}`;
  }

  /**
   * Create or update index for an entity type
   */
  async createIndex(entityType: IndexDocument['entityType']): Promise<void> {
    const client = await this.getClient();
    const indexName = this.getIndexName(entityType);

    if (this.config.backend === 'opensearch') {
      // OpenSearch index creation
      const exists = await client.indices.exists({ index: indexName });
      if (!exists.body) {
        await client.indices.create({
          index: indexName,
          body: {
            settings: {
              analysis: {
                analyzer: {
                  default: {
                    type: 'standard',
                    stopwords: '_english_',
                  },
                },
              },
            },
            mappings: {
              properties: {
                id: { type: 'keyword' },
                entityType: { type: 'keyword' },
                title: { type: 'text', analyzer: 'standard' },
                description: { type: 'text', analyzer: 'standard' },
                content: { type: 'text', analyzer: 'standard' },
                metadata: { type: 'object', enabled: true },
                createdAt: { type: 'date' },
                updatedAt: { type: 'date' },
              },
            },
          },
        });
      }
    } else {
      // Meilisearch index creation
      try {
        await client.getIndex(indexName);
      } catch (error: any) {
        if (error.code === 'index_not_found') {
          await client.createIndex(indexName, {
            primaryKey: 'id',
          });
          await client.index(indexName).updateSettings({
            searchableAttributes: ['title', 'description', 'content'],
            filterableAttributes: ['entityType', 'metadata'],
            sortableAttributes: ['createdAt', 'updatedAt'],
          });
        }
      }
    }
  }

  /**
   * Index a single document
   */
  async indexDocument(document: IndexDocument): Promise<void> {
    const client = await this.getClient();
    const indexName = this.getIndexName(document.entityType);

    if (this.config.backend === 'opensearch') {
      await client.index({
        index: indexName,
        id: document.id,
        body: document,
      });
    } else {
      await client.index(indexName).addDocuments([document]);
    }
  }

  /**
   * Index multiple documents in batch
   */
  async indexDocuments(documents: IndexDocument[]): Promise<void> {
    if (documents.length === 0) return;

    const client = await this.getClient();

    // Group by entity type
    const grouped = documents.reduce((acc, doc) => {
      if (!acc[doc.entityType]) {
        acc[doc.entityType] = [];
      }
      acc[doc.entityType].push(doc);
      return acc;
    }, {} as Record<string, IndexDocument[]>);

    // Index each group
    for (const [entityType, docs] of Object.entries(grouped)) {
      const indexName = this.getIndexName(entityType as IndexDocument['entityType']);

      if (this.config.backend === 'opensearch') {
        const body = docs.flatMap((doc) => [
          { index: { _index: indexName, _id: doc.id } },
          doc,
        ]);
        await client.bulk({ body });
      } else {
        await client.index(indexName).addDocuments(docs);
      }
    }
  }

  /**
   * Delete a document from index
   */
  async deleteDocument(entityType: IndexDocument['entityType'], documentId: string): Promise<void> {
    const client = await this.getClient();
    const indexName = this.getIndexName(entityType);

    if (this.config.backend === 'opensearch') {
      await client.delete({
        index: indexName,
        id: documentId,
      });
    } else {
      await client.index(indexName).deleteDocument(documentId);
    }
  }

  /**
   * Update a document in index (delete + reindex)
   */
  async updateDocument(document: IndexDocument): Promise<void> {
    await this.indexDocument(document);
  }

  /**
   * Rebuild index for an entity type (full rebuild)
   */
  async rebuildIndex(entityType: IndexDocument['entityType']): Promise<void> {
    const client = await this.getClient();
    const indexName = this.getIndexName(entityType);

    // Delete existing index
    if (this.config.backend === 'opensearch') {
      const exists = await client.indices.exists({ index: indexName });
      if (exists.body) {
        await client.indices.delete({ index: indexName });
      }
    } else {
      try {
        await client.deleteIndex(indexName);
      } catch (error: any) {
        if (error.code !== 'index_not_found') {
          throw error;
        }
      }
    }

    // Recreate index
    await this.createIndex(entityType);

    // Fetch all documents from database and index them
    const documents = await this.fetchAllDocuments(entityType);
    if (documents.length > 0) {
      await this.indexDocuments(documents);
    }
  }

  /**
   * Fetch all documents of a type from database
   */
  private async fetchAllDocuments(entityType: IndexDocument['entityType']): Promise<IndexDocument[]> {
    switch (entityType) {
      case 'provider':
        const providers = await this.prisma.pECOSProvider.findMany({
          include: {
            documents: true,
          },
        });
        return providers.map((p) => ({
          id: p.id,
          entityType: 'provider',
          title: `Provider ${p.npi}`,
          description: `Medicare Provider ${p.enrollmentType}`,
          content: `${p.npi} ${p.medicareId || ''} ${p.enrollmentType} ${p.status}`,
          metadata: {
            npi: p.npi,
            medicareId: p.medicareId,
            enrollmentType: p.enrollmentType,
            status: p.status,
            effectiveDate: p.effectiveDate,
            revalidationDate: p.revalidationDate,
          },
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }));

      case 'credential':
        const credentials = await this.prisma.credential.findMany();
        return credentials.map((c) => ({
          id: c.id,
          entityType: 'credential',
          title: c.name,
          description: `Issued by ${c.issuer}`,
          content: `${c.name} ${c.issuer} ${c.type} ${c.status}`,
          metadata: {
            issuer: c.issuer,
            issuerDid: c.issuerDid,
            holderDid: c.holderDid,
            type: c.type,
            status: c.status,
            issuedAt: c.issuedAt,
            expiresAt: c.expiresAt,
          },
          createdAt: c.issuedAt,
          updatedAt: c.issuedAt,
        }));

      case 'module':
        const modules = await this.prisma.marketplaceModule.findMany();
        return modules.map((m) => ({
          id: m.id,
          entityType: 'module',
          title: m.name,
          description: m.description,
          content: `${m.name} ${m.description} ${m.capabilities.join(' ')}`,
          metadata: {
            version: m.version,
            vendorId: m.vendorId,
            capabilities: m.capabilities,
            price: m.price,
            currency: m.currency,
            licenseType: m.licenseType,
            approvalStatus: m.approvalStatus,
            averageRating: m.averageRating,
          },
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        }));

      case 'contract':
        const contracts = await this.prisma.partnerContract.findMany();
        return contracts.map((c) => ({
          id: c.id,
          entityType: 'contract',
          title: `Contract ${c.id}`,
          description: `Contract between ${c.orgId} and ${c.counterpartyId}`,
          content: `${c.orgId} ${c.counterpartyId} ${c.status} ${JSON.stringify(c.terms || {})}`,
          metadata: {
            orgId: c.orgId,
            counterpartyId: c.counterpartyId,
            templateId: c.templateId,
            status: c.status,
            effectiveDate: c.effectiveDate,
            expiryDate: c.expiryDate,
            terms: c.terms,
          },
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }));

      case 'job':
        const jobs = await this.prisma.jobPosting.findMany();
        return jobs.map((j) => ({
          id: j.id,
          entityType: 'job',
          title: j.title,
          description: j.description || '',
          content: `${j.title} ${j.description || ''} ${j.specialty} ${j.requiredStates.join(' ')}`,
          metadata: {
            partnerId: j.partnerId,
            externalJobId: j.externalJobId,
            specialty: j.specialty,
            requiredStates: j.requiredStates,
            targetLicenseJurisdictions: j.targetLicenseJurisdictions,
            modality: j.modality,
            location: j.location,
            compRangeMin: j.compRangeMin,
            compRangeMax: j.compRangeMax,
            compCurrency: j.compCurrency,
            telehealth: j.telehealth,
            imlcEligible: j.imlcEligible,
            status: j.status,
          },
          createdAt: j.createdAt,
          updatedAt: j.updatedAt,
        }));

      default:
        return [];
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(entityType: IndexDocument['entityType']): Promise<IndexStats> {
    const client = await this.getClient();
    const indexName = this.getIndexName(entityType);

    if (this.config.backend === 'opensearch') {
      const stats = await client.count({ index: indexName });
      return {
        totalDocuments: stats.body.count,
        lastIndexedAt: null, // Would need to track this separately
        indexSize: 0, // Would need to calculate from index stats
      };
    } else {
      const stats = await client.index(indexName).getStats();
      return {
        totalDocuments: stats.numberOfDocuments,
        lastIndexedAt: null,
        indexSize: stats.indexSize,
      };
    }
  }

  /**
   * Initialize all indexes
   */
  async initializeAllIndexes(): Promise<void> {
    const entityTypes: IndexDocument['entityType'][] = [
      'provider',
      'credential',
      'module',
      'contract',
      'job',
    ];

    for (const entityType of entityTypes) {
      await this.createIndex(entityType);
    }
  }
}

