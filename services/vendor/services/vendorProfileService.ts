/**
 * B240A-VM-004: VendorProfileService
 *
 * Creates and manages vendor profiles: CRUD operations; merges vendor data
 * from external sources; ensures category assignment; includes unit tests
 */

import { PrismaClient, VendorStatus } from '@prisma/client';
import {
  createVendor,
  getVendor,
  getVendorsByOrg,
  updateVendor,
  archiveVendor,
  deleteVendor,
  VendorInput,
  Vendor,
} from '../models/Vendor.js';
import {
  createVendorCategory,
  getVendorCategory,
  VendorCategoryInput,
} from '../models/VendorCategory.js';
import {
  createVendorContact,
  getVendorContacts,
  VendorContactInput,
} from '../models/VendorContact.js';

export interface ExternalVendorData {
  name: string;
  category?: string; // Category name, will be resolved to categoryId
  description?: string;
  website?: string;
  contacts?: Array<{
    name: string;
    role?: string;
    email?: string;
    phone?: string;
  }>;
  metadata?: Record<string, any>;
}

export interface MergeVendorOptions {
  createCategoryIfMissing?: boolean;
  defaultCategoryName?: string;
  updateExisting?: boolean;
}

export class VendorProfileService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new vendor profile
   */
  async createVendorProfile(
    orgId: string,
    input: VendorInput
  ): Promise<Vendor> {
    // Ensure category exists
    const category = await getVendorCategory(this.prisma, input.categoryId);
    if (!category) {
      throw new Error(`Category with id ${input.categoryId} not found`);
    }

    return createVendor(this.prisma, {
      ...input,
      orgId,
    });
  }

  /**
   * Get vendor profile by ID
   */
  async getVendorProfile(id: string): Promise<Vendor | null> {
    return getVendor(this.prisma, id);
  }

  /**
   * List vendors for an organization with optional filters
   */
  async listVendors(
    orgId: string,
    filters?: {
      status?: VendorStatus;
      categoryId?: string;
    }
  ): Promise<Vendor[]> {
    return getVendorsByOrg(this.prisma, orgId, filters);
  }

  /**
   * Update vendor profile
   */
  async updateVendorProfile(
    id: string,
    updates: Partial<VendorInput>
  ): Promise<Vendor> {
    // If updating category, verify it exists
    if (updates.categoryId) {
      const category = await getVendorCategory(this.prisma, updates.categoryId);
      if (!category) {
        throw new Error(`Category with id ${updates.categoryId} not found`);
      }
    }

    return updateVendor(this.prisma, id, updates);
  }

  /**
   * Archive vendor (set status to INACTIVE)
   */
  async archiveVendorProfile(id: string): Promise<Vendor> {
    return archiveVendor(this.prisma, id);
  }

  /**
   * Delete vendor profile
   */
  async deleteVendorProfile(id: string): Promise<void> {
    return deleteVendor(this.prisma, id);
  }

  /**
   * Merge vendor data from external sources
   * This is useful when importing vendor data from external systems
   */
  async mergeVendorFromExternal(
    orgId: string,
    externalData: ExternalVendorData,
    options: MergeVendorOptions = {}
  ): Promise<Vendor> {
    const {
      createCategoryIfMissing = false,
      defaultCategoryName = 'Other',
      updateExisting = false,
    } = options;

    // Resolve category
    let categoryId: string;
    if (externalData.category) {
      // Try to find existing category by name
      const category = await this.prisma.vendorCategory.findUnique({
        where: { name: externalData.category },
      });

      if (category) {
        categoryId = category.id;
      } else if (createCategoryIfMissing) {
        // Create new category
        const newCategory = await createVendorCategory(this.prisma, {
          name: externalData.category,
          description: `Auto-created category for ${externalData.category}`,
        });
        categoryId = newCategory.id;
      } else {
        // Use default category
        const defaultCategory = await this.prisma.vendorCategory.findUnique({
          where: { name: defaultCategoryName },
        });
        if (!defaultCategory) {
          throw new Error(`Default category "${defaultCategoryName}" not found`);
        }
        categoryId = defaultCategory.id;
      }
    } else {
      // Use default category
      const defaultCategory = await this.prisma.vendorCategory.findUnique({
        where: { name: defaultCategoryName },
      });
      if (!defaultCategory) {
        throw new Error(`Default category "${defaultCategoryName}" not found`);
      }
      categoryId = defaultCategory.id;
    }

    // Check if vendor already exists (by name and org)
    let vendor: Vendor | null = null;
    if (updateExisting) {
      const existing = await this.prisma.vendor.findFirst({
        where: {
          name: externalData.name,
          orgId,
        },
      });
      if (existing) {
        vendor = existing;
      }
    }

    if (vendor) {
      // Update existing vendor
      vendor = await updateVendor(this.prisma, vendor.id, {
        description: externalData.description,
        website: externalData.website,
        categoryId,
      });
    } else {
      // Create new vendor
      vendor = await createVendor(this.prisma, {
        name: externalData.name,
        orgId,
        categoryId,
        description: externalData.description,
        website: externalData.website,
        status: VendorStatus.PENDING,
      });
    }

    // Create contacts if provided
    if (externalData.contacts && externalData.contacts.length > 0) {
      for (const contactData of externalData.contacts) {
        await createVendorContact(this.prisma, {
          vendorId: vendor.id,
          name: contactData.name,
          role: contactData.role,
          email: contactData.email,
          phone: contactData.phone,
        });
      }
    }

    return vendor;
  }

  /**
   * Get vendor with related data (contacts, category, etc.)
   */
  async getVendorWithRelations(id: string) {
    const vendor = await getVendor(this.prisma, id);
    if (!vendor) {
      return null;
    }

    const [contacts, category, onboardingFlow] = await Promise.all([
      getVendorContacts(this.prisma, id),
      getVendorCategory(this.prisma, vendor.categoryId),
      this.prisma.vendorOnboardingFlow.findUnique({
        where: { vendorId: id },
      }),
    ]);

    return {
      ...vendor,
      contacts,
      category,
      onboardingFlow,
    };
  }

  /**
   * Ensure category assignment - validates and assigns default if missing
   */
  async ensureCategoryAssignment(
    vendorId: string,
    defaultCategoryName: string = 'Other'
  ): Promise<Vendor> {
    const vendor = await getVendor(this.prisma, vendorId);
    if (!vendor) {
      throw new Error(`Vendor with id ${vendorId} not found`);
    }

    // Check if category exists
    const category = await getVendorCategory(this.prisma, vendor.categoryId);
    if (!category) {
      // Find or create default category
      let defaultCategory = await this.prisma.vendorCategory.findUnique({
        where: { name: defaultCategoryName },
      });

      if (!defaultCategory) {
        defaultCategory = await createVendorCategory(this.prisma, {
          name: defaultCategoryName,
          description: 'Default vendor category',
        });
      }

      // Update vendor with default category
      return updateVendor(this.prisma, vendorId, {
        categoryId: defaultCategory.id,
      });
    }

    return vendor;
  }
}

