const log = getServiceLogger('tefca/tefcaFacade');
/**
 * B136A-TEFCA-007: TEFCA Facade Service
 *
 * Unified interface for querying TEFCA QHIN network.
 * Enforces Purpose of Use (PoU) requirements and logs all requests.
 *
 * TEFCA Compliance:
 * - All requests must include valid Purpose of Use
 * - Purpose must be in organization's allowed list
 * - All queries are logged for audit trail
 */

import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import { QhinConfig, TefcaPurposeOfUse, isPurposeAllowed } from './models/QhinConfig';
import crypto from 'crypto';
import { getServiceLogger } from '../logging/serviceLogger';

const prisma = new PrismaClient();

export interface TefcaQueryParams {
  resourceType: 'Practitioner' | 'PractitionerRole';
  searchParams: Record<string, string>;
  purposeOfUse: TefcaPurposeOfUse;
}

export interface TefcaQueryResult {
  success: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
  duration: number;
}

/**
 * TEFCA Facade Service
 */
export class TefcaFacade {
  private config: QhinConfig;
  private orgId: string;

  constructor(config: QhinConfig) {
    this.config = config;
    this.orgId = config.orgId;
  }

  /**
   * Query TEFCA QHIN network
   */
  async query(params: TefcaQueryParams): Promise<TefcaQueryResult> {
    const startTime = Date.now();

    // Validate Purpose of Use
    if (!isPurposeAllowed(this.config, params.purposeOfUse)) {
      const duration = Date.now() - startTime;
      await this.logAudit(params, undefined, duration, 'Purpose of Use not allowed');

      return {
        success: false,
        error: `Purpose of Use '${params.purposeOfUse}' is not allowed for this organization`,
        duration,
      };
    }

    try {
      // Build QHIN query URL
      const searchParams = new URLSearchParams(params.searchParams);
      const url = `${this.config.qhinEndpoint}/${params.resourceType}?${searchParams.toString()}`;

      // Execute QHIN query with Purpose of Use header
      const response = await fetch(url, {
        headers: {
          Accept: 'application/fhir+json',
          'X-Purpose-Of-Use': params.purposeOfUse,
          'X-Org-Identifier': this.config.orgIdentifier,
          // TODO: Add TEFCA-specific auth headers from authConfig
        },
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        await this.logAudit(params, response.status, duration, errorText);

        return {
          success: false,
          error: `QHIN query failed: ${response.status} - ${errorText}`,
          statusCode: response.status,
          duration,
        };
      }

      const bundle = await response.json();
      await this.logAudit(params, response.status, duration);

      return {
        success: true,
        data: bundle,
        statusCode: response.status,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.logAudit(params, undefined, duration, errorMessage);

      return {
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Search Practitioner in TEFCA network
   */
  async searchPractitioner(
    searchParams: Record<string, string>,
    purposeOfUse: TefcaPurposeOfUse
  ): Promise<TefcaQueryResult> {
    return this.query({
      resourceType: 'Practitioner',
      searchParams,
      purposeOfUse,
    });
  }

  /**
   * Search PractitionerRole in TEFCA network
   */
  async searchPractitionerRole(
    searchParams: Record<string, string>,
    purposeOfUse: TefcaPurposeOfUse
  ): Promise<TefcaQueryResult> {
    return this.query({
      resourceType: 'PractitionerRole',
      searchParams,
      purposeOfUse,
    });
  }

  /**
   * Log audit event for TEFCA query
   */
  private async logAudit(
    params: TefcaQueryParams,
    statusCode?: number,
    duration?: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      // Create PHI-stripped query hash
      const queryHash = crypto
        .createHash('sha256')
        .update(JSON.stringify({
          resourceType: params.resourceType,
          searchParams: params.searchParams,
        }))
        .digest('hex');

      await prisma.ehrFacadeAudit.create({
        data: {
          orgId: this.orgId,
          source: 'tefca',
          resourceType: params.resourceType,
          queryHash,
          purposeOfUse: params.purposeOfUse,
          statusCode,
          duration,
          errorMessage,
          metadata: {
            qhinEndpoint: this.config.qhinEndpoint,
            orgIdentifier: this.config.orgIdentifier,
          },
        },
      });
    } catch (error) {
      log.error('[TefcaFacade] Failed to log audit:', error);
      // Don't throw - audit logging failure shouldn't break the query
    }
  }

  /**
   * Test TEFCA QHIN connectivity
   */
  async testConnection(): Promise<{ success: boolean; error?: string; metadata?: any }> {
    try {
      const response = await fetch(`${this.config.qhinEndpoint}/metadata`, {
        headers: {
          Accept: 'application/fhir+json',
          'X-Org-Identifier': this.config.orgIdentifier,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `QHIN metadata endpoint returned ${response.status}`,
        };
      }

      const metadata = await response.json();

      return {
        success: true,
        metadata: {
          fhirVersion: metadata.fhirVersion,
          software: metadata.software,
          qhinName: metadata.implementation?.description,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get allowed purposes for this organization
   */
  getAllowedPurposes(): TefcaPurposeOfUse[] {
    return this.config.allowedPurposes as TefcaPurposeOfUse[];
  }
}

/**
 * Factory function to create TEFCA Facade from config
 */
export async function createTefcaFacade(orgId: string): Promise<TefcaFacade | null> {
  const config = await prisma.qhinConfig.findUnique({
    where: { orgId, isActive: true },
  });

  if (!config) {
    return null;
  }

  return new TefcaFacade(config as any);
}

/**
 * Validate Purpose of Use against allowed list
 */
export async function validatePurposeOfUse(
  orgId: string,
  purpose: string
): Promise<{ valid: boolean; error?: string }> {
  const config = await prisma.qhinConfig.findUnique({
    where: { orgId, isActive: true },
  });

  if (!config) {
    return {
      valid: false,
      error: 'Organization does not have TEFCA configuration',
    };
  }

  if (!config.allowedPurposes.includes(purpose)) {
    return {
      valid: false,
      error: `Purpose of Use '${purpose}' is not allowed for this organization`,
    };
  }

  return { valid: true };
}

