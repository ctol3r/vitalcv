const log = getServiceLogger('ehr/ehrFacade');
/**
 * B136A-EHR-003: EHR Facade Service
 *
 * Unified interface for querying EHR FHIR APIs (Epic, Cerner, Generic).
 * Handles:
 * - Practitioner and PractitionerRole queries
 * - Response mapping to standard format
 * - Audit logging
 * - Error handling and retries
 */

import { PrismaClient } from '@prisma/client';
import { SmartClient } from './smartClient';
import { EhrConfig } from './models/EhrConfig';
import crypto from 'crypto';
import { getServiceLogger } from '../logging/serviceLogger';

const prisma = new PrismaClient();

export interface PractitionerSearchParams {
  npi?: string;
  name?: string;
  identifier?: string;
}

export interface PractitionerRoleSearchParams {
  practitioner?: string; // Practitioner ID
  organization?: string;
  specialty?: string;
}

export interface FacadeQueryResult {
  success: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
  duration: number;
}

/**
 * EHR Facade Service
 */
export class EhrFacade {
  private config: EhrConfig;
  private client: SmartClient;
  private orgId: string;

  constructor(config: EhrConfig) {
    this.config = config;
    this.client = new SmartClient(config);
    this.orgId = config.orgId;
  }

  /**
   * Search for Practitioner resources
   */
  async searchPractitioner(params: PractitionerSearchParams): Promise<FacadeQueryResult> {
    const startTime = Date.now();

    try {
      // Build FHIR search query
      const searchParams = new URLSearchParams();

      if (params.npi) {
        searchParams.append('identifier', `http://hl7.org/fhir/sid/us-npi|${params.npi}`);
      }
      if (params.name) {
        searchParams.append('name', params.name);
      }
      if (params.identifier) {
        searchParams.append('identifier', params.identifier);
      }

      // Execute FHIR query
      const path = `Practitioner?${searchParams.toString()}`;
      const response = await this.client.request(path);

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        await this.logAudit('Practitioner', params, response.status, duration, errorText);

        return {
          success: false,
          error: `EHR query failed: ${response.status} - ${errorText}`,
          statusCode: response.status,
          duration,
        };
      }

      const bundle = await response.json();

      // Log successful query
      await this.logAudit('Practitioner', params, response.status, duration);

      return {
        success: true,
        data: bundle,
        statusCode: response.status,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.logAudit('Practitioner', params, undefined, duration, errorMessage);

      return {
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Search for PractitionerRole resources
   */
  async searchPractitionerRole(params: PractitionerRoleSearchParams): Promise<FacadeQueryResult> {
    const startTime = Date.now();

    try {
      const searchParams = new URLSearchParams();

      if (params.practitioner) {
        searchParams.append('practitioner', params.practitioner);
      }
      if (params.organization) {
        searchParams.append('organization', params.organization);
      }
      if (params.specialty) {
        searchParams.append('specialty', params.specialty);
      }

      const path = `PractitionerRole?${searchParams.toString()}`;
      const response = await this.client.request(path);

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        await this.logAudit('PractitionerRole', params, response.status, duration, errorText);

        return {
          success: false,
          error: `EHR query failed: ${response.status} - ${errorText}`,
          statusCode: response.status,
          duration,
        };
      }

      const bundle = await response.json();
      await this.logAudit('PractitionerRole', params, response.status, duration);

      return {
        success: true,
        data: bundle,
        statusCode: response.status,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.logAudit('PractitionerRole', params, undefined, duration, errorMessage);

      return {
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Get Practitioner by ID
   */
  async getPractitionerById(id: string): Promise<FacadeQueryResult> {
    const startTime = Date.now();

    try {
      const response = await this.client.request(`Practitioner/${id}`);
      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        await this.logAudit('Practitioner', { id }, response.status, duration, errorText);

        return {
          success: false,
          error: `EHR query failed: ${response.status} - ${errorText}`,
          statusCode: response.status,
          duration,
        };
      }

      const practitioner = await response.json();
      await this.logAudit('Practitioner', { id }, response.status, duration);

      return {
        success: true,
        data: practitioner,
        statusCode: response.status,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.logAudit('Practitioner', { id }, undefined, duration, errorMessage);

      return {
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Log audit event for EHR query
   */
  private async logAudit(
    resourceType: string,
    queryParams: any,
    statusCode?: number,
    duration?: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      // Create PHI-stripped query hash
      const queryHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(queryParams))
        .digest('hex');

      await prisma.ehrFacadeAudit.create({
        data: {
          orgId: this.orgId,
          source: 'ehr',
          resourceType,
          queryHash,
          purposeOfUse: null, // EHR queries don't require explicit PoU (unlike TEFCA)
          statusCode,
          duration,
          errorMessage,
          metadata: {
            ehrType: this.config.ehrType,
            fhirBaseUrl: this.config.fhirBaseUrl,
          },
        },
      });
    } catch (error) {
      log.error('[EhrFacade] Failed to log audit:', error);
      // Don't throw - audit logging failure shouldn't break the query
    }
  }

  /**
   * Test EHR connectivity
   */
  async testConnection(): Promise<{ success: boolean; error?: string; metadata?: any }> {
    try {
      const response = await this.client.request('metadata');

      if (!response.ok) {
        return {
          success: false,
          error: `Metadata endpoint returned ${response.status}`,
        };
      }

      const metadata = await response.json();

      return {
        success: true,
        metadata: {
          fhirVersion: metadata.fhirVersion,
          software: metadata.software,
          implementation: metadata.implementation,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Factory function to create EHR Facade from config
 */
export async function createEhrFacade(orgId: string): Promise<EhrFacade | null> {
  const config = await prisma.ehrConfig.findUnique({
    where: { orgId, isActive: true },
  });

  if (!config) {
    return null;
  }

  return new EhrFacade(config as any);
}

