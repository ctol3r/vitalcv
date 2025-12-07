/**
 * S72-D1-B-001: License PSV stub - query mock state board API
 *
 * POST /psv/license with {npi, state, licenseNumber}
 * Returns {status: ACTIVE/INACTIVE, sourceUrl, checkedAt}
 *
 * Uses in-memory fake API for testing purposes
 * In production, this would integrate with actual state board APIs
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Mock state board database
// In production, this would be replaced with actual API calls
const MOCK_LICENSES: Record<string, {
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED';
  npi: string;
  state: string;
  licenseNumber: string;
}> = {
  // Test data for unit tests
  'CA:123456:1234567890': {
    status: 'ACTIVE',
    npi: '1234567890',
    state: 'CA',
    licenseNumber: '123456',
  },
  'NY:789012:0987654321': {
    status: 'INACTIVE',
    npi: '0987654321',
    state: 'NY',
    licenseNumber: '789012',
  },
  'TX:555555:1111111111': {
    status: 'EXPIRED',
    npi: '1111111111',
    state: 'TX',
    licenseNumber: '555555',
  },
  'FL:666666:2222222222': {
    status: 'SUSPENDED',
    npi: '2222222222',
    state: 'FL',
    licenseNumber: '666666',
  },
};

export interface LicenseCheckRequest {
  npi: string;
  state: string;
  licenseNumber: string;
}

export interface LicenseCheckResponse {
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED';
  sourceUrl: string;
  checkedAt: string;
  npi: string;
  state: string;
  licenseNumber: string;
  checkId?: string;
}

/**
 * Mock state board API query
 * In production, this would make actual API calls to state medical boards
 */
async function queryStateBoardAPI(
  npi: string,
  state: string,
  licenseNumber: string
): Promise<{
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED';
  sourceUrl: string;
}> {
  const key = `${state}:${licenseNumber}:${npi}`;
  const mockData = MOCK_LICENSES[key];

  if (mockData) {
    return {
      status: mockData.status,
      sourceUrl: `https://stateboard.${state.toLowerCase()}.gov/verify/${licenseNumber}`,
    };
  }

  // Default to ACTIVE for unknown licenses (in mock mode)
  return {
    status: 'ACTIVE',
    sourceUrl: `https://stateboard.${state.toLowerCase()}.gov/verify/${licenseNumber}`,
  };
}

/**
 * POST /psv/license
 *
 * Check license status against state board
 *
 * Request body:
 * {
 *   npi: string,
 *   state: string,
 *   licenseNumber: string
 * }
 *
 * Response:
 * {
 *   status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED',
 *   sourceUrl: string,
 *   checkedAt: string,
 *   npi: string,
 *   state: string,
 *   licenseNumber: string,
 *   checkId: string
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { npi, state, licenseNumber } = req.body as LicenseCheckRequest;

    // Validation
    if (!npi || !state || !licenseNumber) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'npi, state, and licenseNumber are required',
      });
    }

    // Validate state code (2 letters)
    if (!/^[A-Z]{2}$/i.test(state)) {
      return res.status(400).json({
        error: 'invalid_state',
        error_description: 'state must be a valid 2-letter state code',
      });
    }

    // Validate NPI (10 digits)
    if (!/^\d{10}$/.test(npi)) {
      return res.status(400).json({
        error: 'invalid_npi',
        error_description: 'npi must be a 10-digit number',
      });
    }

    // Query mock state board API
    const checkedAt = new Date();
    const { status, sourceUrl } = await queryStateBoardAPI(
      npi,
      state.toUpperCase(),
      licenseNumber
    );

    // Store license check in database
    const licenseCheck = await prisma.pSVLicenseCheck.create({
      data: {
        npi,
        state: state.toUpperCase(),
        licenseNumber,
        status,
        sourceUrl,
        checkedAt,
        rawResponse: {
          npi,
          state: state.toUpperCase(),
          licenseNumber,
          status,
          sourceUrl,
          timestamp: checkedAt.toISOString(),
        },
        metadata: {
          apiVersion: 'mock-v1',
          checkType: 'state-board',
        },
      },
    });

    const response: LicenseCheckResponse = {
      status,
      sourceUrl,
      checkedAt: checkedAt.toISOString(),
      npi,
      state: state.toUpperCase(),
      licenseNumber,
      checkId: licenseCheck.id,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('[PSV License Check] Error:', error);
    return res.status(500).json({
      error: 'check_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /psv/license/:checkId
 *
 * Retrieve a previously performed license check
 */
router.get('/:checkId', async (req: Request, res: Response) => {
  try {
    const { checkId } = req.params;

    const licenseCheck = await prisma.pSVLicenseCheck.findUnique({
      where: { id: checkId },
    });

    if (!licenseCheck) {
      return res.status(404).json({
        error: 'not_found',
        error_description: 'License check not found',
      });
    }

    const response: LicenseCheckResponse = {
      status: licenseCheck.status as 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED',
      sourceUrl: licenseCheck.sourceUrl || '',
      checkedAt: licenseCheck.checkedAt.toISOString(),
      npi: licenseCheck.npi,
      state: licenseCheck.state,
      licenseNumber: licenseCheck.licenseNumber,
      checkId: licenseCheck.id,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('[PSV License Check Retrieval] Error:', error);
    return res.status(500).json({
      error: 'retrieval_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

