/**
 * B232A-SEARCH-003: SearchIngestPipeline
 *
 * Transforms and normalizes data from various services (reputation, marketplace, contracts)
 * into search indexable format.
 * Ensures synonyms and tokenization are handled.
 */

import { PrismaClient } from '@prisma/client';
import { IndexDocument } from './indexService.js';

export interface IngestOptions {
  normalizeSynonyms?: boolean;
  tokenizeContent?: boolean;
  enrichWithReputation?: boolean;
  enrichWithMarketplace?: boolean;
}

/**
 * SearchIngestPipeline - Transforms data into searchable format
 */
export class SearchIngestPipeline {
  private prisma: PrismaClient;
  private synonymMap: Map<string, string[]>;
  private stopWords: Set<string>;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.synonymMap = this.initializeSynonyms();
    this.stopWords = this.initializeStopWords();
  }

  /**
   * Initialize medical/healthcare synonyms
   */
  private initializeSynonyms(): Map<string, string[]> {
    const map = new Map<string, string[]>();

    // Medical specialty synonyms
    map.set('cardiology', ['heart', 'cardiac', 'cardiovascular']);
    map.set('orthopedics', ['orthopedic', 'bone', 'skeletal']);
    map.set('pediatrics', ['pediatric', 'children', 'child']);
    map.set('psychiatry', ['psychiatric', 'mental health', 'behavioral']);

    // Credential type synonyms
    map.set('license', ['licensure', 'licensed', 'licensing']);
    map.set('certification', ['certified', 'certificate', 'cert']);
    map.set('credential', ['credentialing', 'credentials']);

    // Status synonyms
    map.set('active', ['current', 'valid', 'active']);
    map.set('expired', ['inactive', 'invalid', 'expired']);

    return map;
  }

  /**
   * Initialize stop words
   */
  private initializeStopWords(): Set<string> {
    return new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'the', 'this', 'but', 'they', 'have',
      'had', 'what', 'said', 'each', 'which', 'their', 'time', 'if',
      'up', 'out', 'many', 'then', 'them', 'these', 'so', 'some', 'her',
      'would', 'make', 'like', 'into', 'him', 'has', 'two', 'more',
      'go', 'no', 'way', 'could', 'my', 'than', 'first', 'been', 'call',
      'who', 'oil', 'sit', 'now', 'find', 'down', 'day', 'did', 'get',
      'come', 'made', 'may', 'part',
    ]);
  }

  /**
   * Transform provider data into search document
   */
  async transformProvider(providerId: string, options?: IngestOptions): Promise<IndexDocument> {
    const provider = await this.prisma.pECOSProvider.findUnique({
      where: { id: providerId },
      include: {
        documents: true,
      },
    });

    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    const title = `Provider ${provider.npi}`;
    const description = `Medicare Provider - ${provider.enrollmentType} (${provider.status})`;

    let content = `${provider.npi} ${provider.medicareId || ''} ${provider.enrollmentType} ${provider.status}`;

    // Enrich with reputation if available
    let reputationData: any = {};
    if (options?.enrichWithReputation) {
      reputationData = await this.getReputationData('provider', providerId);
      if (reputationData.score) {
        content += ` reputation:${reputationData.score}`;
      }
    }

    // Normalize synonyms
    if (options?.normalizeSynonyms) {
      content = this.normalizeSynonyms(content);
    }

    // Tokenize and clean
    if (options?.tokenizeContent) {
      content = this.tokenize(content);
    }

    return {
      id: provider.id,
      entityType: 'provider',
      title,
      description,
      content,
      metadata: {
        npi: provider.npi,
        medicareId: provider.medicareId,
        enrollmentType: provider.enrollmentType,
        status: provider.status,
        effectiveDate: provider.effectiveDate,
        revalidationDate: provider.revalidationDate,
        ...reputationData,
      },
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }

  /**
   * Transform credential data into search document
   */
  async transformCredential(credentialId: string, options?: IngestOptions): Promise<IndexDocument> {
    const credential = await this.prisma.credential.findUnique({
      where: { id: credentialId },
    });

    if (!credential) {
      throw new Error(`Credential not found: ${credentialId}`);
    }

    const title = credential.name;
    const description = `Issued by ${credential.issuer}`;

    let content = `${credential.name} ${credential.issuer} ${credential.type} ${credential.status}`;
    if (credential.issuerDid) {
      content += ` issuer:${credential.issuerDid}`;
    }
    if (credential.holderDid) {
      content += ` holder:${credential.holderDid}`;
    }

    // Normalize synonyms
    if (options?.normalizeSynonyms) {
      content = this.normalizeSynonyms(content);
    }

    // Tokenize and clean
    if (options?.tokenizeContent) {
      content = this.tokenize(content);
    }

    return {
      id: credential.id,
      entityType: 'credential',
      title,
      description,
      content,
      metadata: {
        issuer: credential.issuer,
        issuerDid: credential.issuerDid,
        holderDid: credential.holderDid,
        type: credential.type,
        status: credential.status,
        issuedAt: credential.issuedAt,
        expiresAt: credential.expiresAt,
      },
      createdAt: credential.issuedAt,
      updatedAt: credential.issuedAt,
    };
  }

  /**
   * Transform module data into search document
   */
  async transformModule(moduleId: string, options?: IngestOptions): Promise<IndexDocument> {
    const module = await this.prisma.marketplaceModule.findUnique({
      where: { id: moduleId },
      include: {
        vendor: true,
      },
    });

    if (!module) {
      throw new Error(`Module not found: ${moduleId}`);
    }

    const title = module.name;
    const description = module.description;

    let content = `${module.name} ${module.description} ${module.capabilities.join(' ')}`;
    if (module.vendor) {
      content += ` vendor:${module.vendor.name}`;
    }

    // Enrich with marketplace data
    let marketplaceData: any = {};
    if (options?.enrichWithMarketplace) {
      marketplaceData = {
        vendorName: module.vendor?.name,
        vendorKycStatus: module.vendor?.kycStatus,
        vendorReputation: module.vendor?.reputationScore,
      };
    }

    // Normalize synonyms
    if (options?.normalizeSynonyms) {
      content = this.normalizeSynonyms(content);
    }

    // Tokenize and clean
    if (options?.tokenizeContent) {
      content = this.tokenize(content);
    }

    return {
      id: module.id,
      entityType: 'module',
      title,
      description,
      content,
      metadata: {
        version: module.version,
        vendorId: module.vendorId,
        capabilities: module.capabilities,
        price: module.price,
        currency: module.currency,
        licenseType: module.licenseType,
        approvalStatus: module.approvalStatus,
        averageRating: module.averageRating,
        ratingCount: module.ratingCount,
        ...marketplaceData,
      },
      createdAt: module.createdAt,
      updatedAt: module.updatedAt,
    };
  }

  /**
   * Transform contract data into search document
   */
  async transformContract(contractId: string, options?: IngestOptions): Promise<IndexDocument> {
    const contract = await this.prisma.partnerContract.findUnique({
      where: { id: contractId },
      include: {
        template: true,
      },
    });

    if (!contract) {
      throw new Error(`Contract not found: ${contractId}`);
    }

    const title = `Contract ${contract.id}`;
    const description = `Contract between ${contract.orgId} and ${contract.counterpartyId}`;

    let content = `${contract.orgId} ${contract.counterpartyId} ${contract.status}`;
    if (contract.template) {
      content += ` template:${contract.template.name}`;
    }
    if (contract.terms) {
      content += ` ${JSON.stringify(contract.terms)}`;
    }

    // Normalize synonyms
    if (options?.normalizeSynonyms) {
      content = this.normalizeSynonyms(content);
    }

    // Tokenize and clean
    if (options?.tokenizeContent) {
      content = this.tokenize(content);
    }

    return {
      id: contract.id,
      entityType: 'contract',
      title,
      description,
      content,
      metadata: {
        orgId: contract.orgId,
        counterpartyId: contract.counterpartyId,
        templateId: contract.templateId,
        templateName: contract.template?.name,
        status: contract.status,
        effectiveDate: contract.effectiveDate,
        expiryDate: contract.expiryDate,
        terms: contract.terms,
      },
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    };
  }

  /**
   * Transform job data into search document
   */
  async transformJob(jobId: string, options?: IngestOptions): Promise<IndexDocument> {
    const job = await this.prisma.jobPosting.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const title = job.title;
    const description = job.description || '';

    let content = `${job.title} ${job.description || ''} ${job.specialty} ${job.requiredStates.join(' ')}`;
    if (job.location) {
      const loc = job.location as any;
      content += ` location:${loc.city || ''} ${loc.state || ''} ${loc.zip || ''}`;
    }

    // Normalize synonyms
    if (options?.normalizeSynonyms) {
      content = this.normalizeSynonyms(content);
    }

    // Tokenize and clean
    if (options?.tokenizeContent) {
      content = this.tokenize(content);
    }

    return {
      id: job.id,
      entityType: 'job',
      title,
      description,
      content,
      metadata: {
        partnerId: job.partnerId,
        externalJobId: job.externalJobId,
        specialty: job.specialty,
        requiredStates: job.requiredStates,
        targetLicenseJurisdictions: job.targetLicenseJurisdictions,
        modality: job.modality,
        location: job.location,
        compRangeMin: job.compRangeMin,
        compRangeMax: job.compRangeMax,
        compCurrency: job.compCurrency,
        telehealth: job.telehealth,
        imlcEligible: job.imlcEligible,
        status: job.status,
      },
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  /**
   * Normalize synonyms in text
   */
  private normalizeSynonyms(text: string): string {
    let normalized = text.toLowerCase();

    for (const [canonical, synonyms] of this.synonymMap.entries()) {
      for (const synonym of synonyms) {
        const regex = new RegExp(`\\b${synonym}\\b`, 'gi');
        normalized = normalized.replace(regex, canonical);
      }
    }

    return normalized;
  }

  /**
   * Tokenize and clean text
   */
  private tokenize(text: string): string {
    // Convert to lowercase
    let tokens = text.toLowerCase();

    // Remove special characters but keep spaces
    tokens = tokens.replace(/[^\w\s]/g, ' ');

    // Split into words
    const words = tokens.split(/\s+/);

    // Remove stop words and empty strings
    const filtered = words.filter(
      (word) => word.length > 0 && !this.stopWords.has(word)
    );

    // Join back with spaces
    return filtered.join(' ');
  }

  /**
   * Get reputation data for an entity
   */
  private async getReputationData(entityType: string, entityId: string): Promise<any> {
    // This would integrate with the reputation service
    // For now, return empty object
    return {};
  }
}

