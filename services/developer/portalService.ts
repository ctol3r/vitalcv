/**
 * B227A-DEV-001: DeveloperPortalService
 *
 * Service for external developers to register, obtain API keys, upload modules, and manage profiles.
 * Stores registration info in VendorProfile and exposes REST and GraphQL endpoints.
 */

import { PrismaClient } from '@prisma/client';
import {
  createVendorProfile,
  getVendorProfile,
  getVendorProfileByDid,
  updateVendorProfile,
  VendorProfileInput,
} from '../marketplace/models/VendorProfile';
import {
  createApiKey,
  getApiKeysByDeveloper,
  revokeApiKey,
  verifyApiKey,
  DeveloperApiKeyInput,
} from './models/DeveloperApiKeys';
import { createModule, MarketplaceModuleInput } from '../marketplace/models/MarketplaceModule';

export interface DeveloperRegistrationInput {
  vendorId: string;
  did?: string;
  name: string;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
    website?: string;
  };
}

export interface DeveloperProfile {
  vendorId: string;
  did: string | null;
  name: string;
  contactInfo: any;
  kycStatus: string;
  reputationScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export class DeveloperPortalService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Register a new developer
   */
  async registerDeveloper(input: DeveloperRegistrationInput): Promise<{
    profile: DeveloperProfile;
    apiKey: { id: string; key: string; createdAt: Date };
  }> {
    // Check if vendor already exists
    const existing = await getVendorProfile(this.prisma, input.vendorId);
    if (existing) {
      throw new Error(`Developer with vendorId ${input.vendorId} already exists`);
    }

    // Create vendor profile
    const vendorInput: VendorProfileInput = {
      vendorId: input.vendorId,
      did: input.did,
      name: input.name,
      contactInfo: input.contactInfo,
      kycStatus: 'PENDING',
      reputationScore: 0,
    };

    const profile = await createVendorProfile(this.prisma, vendorInput);

    // Generate initial API key
    const { apiKey, plainKey } = await createApiKey(this.prisma, {
      developerId: input.vendorId,
    });

    return {
      profile: {
        vendorId: profile.vendorId,
        did: profile.did,
        name: profile.name,
        contactInfo: profile.contactInfo,
        kycStatus: profile.kycStatus,
        reputationScore: profile.reputationScore,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
      apiKey: {
        id: apiKey.id,
        key: plainKey,
        createdAt: apiKey.createdAt,
      },
    };
  }

  /**
   * Get developer profile
   */
  async getDeveloperProfile(vendorId: string): Promise<DeveloperProfile | null> {
    const profile = await getVendorProfile(this.prisma, vendorId);
    if (!profile) {
      return null;
    }

    return {
      vendorId: profile.vendorId,
      did: profile.did,
      name: profile.name,
      contactInfo: profile.contactInfo,
      kycStatus: profile.kycStatus,
      reputationScore: profile.reputationScore,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  /**
   * Get developer profile by DID
   */
  async getDeveloperProfileByDid(did: string): Promise<DeveloperProfile | null> {
    const profile = await getVendorProfileByDid(this.prisma, did);
    if (!profile) {
      return null;
    }

    return {
      vendorId: profile.vendorId,
      did: profile.did,
      name: profile.name,
      contactInfo: profile.contactInfo,
      kycStatus: profile.kycStatus,
      reputationScore: profile.reputationScore,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  /**
   * Update developer profile
   */
  async updateDeveloperProfile(
    vendorId: string,
    updates: Partial<DeveloperRegistrationInput>
  ): Promise<DeveloperProfile> {
    const updateData: any = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.did !== undefined) updateData.did = updates.did;
    if (updates.contactInfo) updateData.contactInfo = updates.contactInfo;

    const updated = await updateVendorProfile(this.prisma, vendorId, updateData);

    return {
      vendorId: updated.vendorId,
      did: updated.did,
      name: updated.name,
      contactInfo: updated.contactInfo,
      kycStatus: updated.kycStatus,
      reputationScore: updated.reputationScore,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Generate a new API key for a developer
   */
  async generateApiKey(vendorId: string): Promise<{ id: string; key: string; createdAt: Date }> {
    // Verify developer exists
    const profile = await getVendorProfile(this.prisma, vendorId);
    if (!profile) {
      throw new Error(`Developer with vendorId ${vendorId} not found`);
    }

    const { apiKey, plainKey } = await createApiKey(this.prisma, {
      developerId: vendorId,
    });

    return {
      id: apiKey.id,
      key: plainKey,
      createdAt: apiKey.createdAt,
    };
  }

  /**
   * List API keys for a developer
   */
  async listApiKeys(vendorId: string): Promise<Array<{ id: string; createdAt: Date; lastUsedAt: Date | null; revoked: boolean }>> {
    const keys = await getApiKeysByDeveloper(this.prisma, vendorId);
    return keys.map((key) => ({
      id: key.id,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      revoked: key.revoked,
    }));
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(apiKeyId: string): Promise<void> {
    await revokeApiKey(this.prisma, apiKeyId);
  }

  /**
   * Verify an API key and return developer ID
   */
  async verifyApiKey(key: string): Promise<string | null> {
    const apiKey = await verifyApiKey(this.prisma, key);
    return apiKey ? apiKey.developerId : null;
  }

  /**
   * Submit a module for approval
   */
  async submitModule(input: MarketplaceModuleInput): Promise<{
    id: string;
    name: string;
    version: string;
    approvalStatus: string;
    createdAt: Date;
  }> {
    // Verify developer exists
    const profile = await getVendorProfile(this.prisma, input.vendorId);
    if (!profile) {
      throw new Error(`Developer with vendorId ${input.vendorId} not found`);
    }

    const module = await createModule(this.prisma, input);

    return {
      id: module.id,
      name: module.name,
      version: module.version,
      approvalStatus: module.approvalStatus,
      createdAt: module.createdAt,
    };
  }
}

