/**
 * S72-D1-B-002: Sanctions PSV stub - query mock OIG endpoint
 *
 * POST /psv/sanctions with {npi}
 * Returns {sanctioned: boolean, sourceUrl, checkedAt}
 *
 * Uses in-memory fake API - always returns false unless special test NPI
 * In production, this would integrate with actual OIG LEIE (List of Excluded Individuals/Entities)
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Mock OIG LEIE database
// Special test NPIs that are flagged as sanctioned
const SANCTIONED_TEST_NPIS = new Set([
  '6666666666', // Test sanctioned provider
  '7777777777', // Test sanctioned provider 2
]);

export interface SanctionsCheckRequest {
  npi: string;
}

export interface SanctionsCheckResponse {
  sanctioned: boolean;
  sourceUrl: string;
  checkedAt: string;
  npi: string;
  checkId?: string;
  exclusionDetails?: {
    exclusionType?: string;
    exclusionDate?: string;
    reinstatementDate?: string;
  };
}

/**
 * Mock OIG LEIE API query
 * In production, this would make actual API calls to OIG LEIE database
 * https://oig.hhs.gov/exclusions/
 */
async function queryOIGAPI(
  npi: string
): Promise<{
  sanctioned: boolean;
  sourceUrl: string;
  exclusionDetails?: {
    exclusionType: string;
    exclusionDate: string;
    reinstatementDate?: string;
  };
}> {
  const sanctioned = SANCTIONED_TEST_NPIS.has(npi);

  const response = {
    sanctioned,
    sourceUrl: 'https://exclusions.oig.hhs.gov/verification.aspx',
  };

  if (sanctioned) {
    return {
      ...response,
      exclusionDetails: {
        exclusionType: 'Medicare/Medicaid Fraud',
        exclusionDate: '2023-01-15',
        reinstatementDate: undefined,
      },
    };
  }

  return response;
}

/**
 * POST /psv/sanctions
 *
 * Check provider sanctions status against OIG LEIE
 *
 * Request body:
 * {
 *   npi: string
 * }
 *
 * Response:
 * {
 *   sanctioned: boolean,
 *   sourceUrl: string,
 *   checkedAt: string,
 *   npi: string,
 *   checkId: string,
 *   exclusionDetails?: {
 *     exclusionType: string,
 *     exclusionDate: string,
 *     reinstatementDate?: string
 *   }
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { npi } = req.body as SanctionsCheckRequest;

    // Validation
    if (!npi) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'npi is required',
      });
    }

    // Validate NPI (10 digits)
    if (!/^\d{10}$/.test(npi)) {
      return res.status(400).json({
        error: 'invalid_npi',
        error_description: 'npi must be a 10-digit number',
      });
    }

    // Query mock OIG API
    const checkedAt = new Date();
    const { sanctioned, sourceUrl, exclusionDetails } = await queryOIGAPI(npi);

    // Store sanctions check in database
    const sanctionsCheck = await prisma.pSVSanctionsCheck.create({
      data: {
        npi,
        sanctioned,
        sourceUrl,
        checkedAt,
        rawResponse: {
          npi,
          sanctioned,
          sourceUrl,
          exclusionDetails,
          timestamp: checkedAt.toISOString(),
        },
        metadata: {
          apiVersion: 'mock-v1',
          checkType: 'oig-leie',
          exclusionDetails,
        },
      },
    });

    const response: SanctionsCheckResponse = {
      sanctioned,
      sourceUrl,
      checkedAt: checkedAt.toISOString(),
      npi,
      checkId: sanctionsCheck.id,
      exclusionDetails,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('[PSV Sanctions Check] Error:', error);
    return res.status(500).json({
      error: 'check_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /psv/sanctions/:checkId
 *
 * Retrieve a previously performed sanctions check
 */
router.get('/:checkId', async (req: Request, res: Response) => {
  try {
    const { checkId } = req.params;

    const sanctionsCheck = await prisma.pSVSanctionsCheck.findUnique({
      where: { id: checkId },
    });

    if (!sanctionsCheck) {
      return res.status(404).json({
        error: 'not_found',
        error_description: 'Sanctions check not found',
      });
    }

    const exclusionDetails = sanctionsCheck.metadata
      ? (sanctionsCheck.metadata as any).exclusionDetails
      : undefined;

    const response: SanctionsCheckResponse = {
      sanctioned: sanctionsCheck.sanctioned,
      sourceUrl: sanctionsCheck.sourceUrl || '',
      checkedAt: sanctionsCheck.checkedAt.toISOString(),
      npi: sanctionsCheck.npi,
      checkId: sanctionsCheck.id,
      exclusionDetails,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('[PSV Sanctions Check Retrieval] Error:', error);
    return res.status(500).json({
      error: 'retrieval_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /psv/sanctions/bulk
 *
 * Check multiple NPIs for sanctions (bulk operation)
 * Useful for batch processing
 *
 * Request body:
 * {
 *   npis: string[]
 * }
 *
 * Response:
 * {
 *   results: SanctionsCheckResponse[]
 * }
 */
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { npis } = req.body as { npis: string[] };

    // Validation
    if (!npis || !Array.isArray(npis)) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'npis array is required',
      });
    }

    if (npis.length === 0) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'npis array cannot be empty',
      });
    }

    if (npis.length > 100) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'npis array cannot exceed 100 items',
      });
    }

    // Validate all NPIs
    for (const npi of npis) {
      if (!/^\d{10}$/.test(npi)) {
        return res.status(400).json({
          error: 'invalid_npi',
          error_description: `Invalid NPI format: ${npi}`,
        });
      }
    }

    // Process all NPIs
    const results: SanctionsCheckResponse[] = [];
    const checkedAt = new Date();

    for (const npi of npis) {
      const { sanctioned, sourceUrl, exclusionDetails } = await queryOIGAPI(npi);

      // Store sanctions check in database
      const sanctionsCheck = await prisma.pSVSanctionsCheck.create({
        data: {
          npi,
          sanctioned,
          sourceUrl,
          checkedAt,
          rawResponse: {
            npi,
            sanctioned,
            sourceUrl,
            exclusionDetails,
            timestamp: checkedAt.toISOString(),
          },
          metadata: {
            apiVersion: 'mock-v1',
            checkType: 'oig-leie',
            batchOperation: true,
            exclusionDetails,
          },
        },
      });

      results.push({
        sanctioned,
        sourceUrl,
        checkedAt: checkedAt.toISOString(),
        npi,
        checkId: sanctionsCheck.id,
        exclusionDetails,
      });
    }

    return res.status(200).json({ results });
  } catch (error) {
    console.error('[PSV Sanctions Bulk Check] Error:', error);
    return res.status(500).json({
      error: 'bulk_check_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

