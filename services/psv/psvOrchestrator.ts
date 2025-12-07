const log = getServiceLogger('psv/psvOrchestrator');
/**
 * S72-D1-B-003: PSV orchestrator service (run license+sanctions for clinician)
 *
 * Orchestrates Primary Source Verification by:
 * 1. Running license verification against state board
 * 2. Running sanctions check against OIG LEIE
 * 3. Combining results into a single PSV result
 * 4. Storing in database with freshness tracking
 *
 * Returns combined result object with PASS/FAIL/WARNING status
 */

import { PrismaClient } from '@prisma/client';
import { eventBus } from '../../backend/src/services/notifications/eventBus';
import { enqueueJob } from '../queue/producer.js';
import { getServiceLogger } from '../logging/serviceLogger';

const prisma = new PrismaClient();

export interface PSVOrchestratorInput {
  clinicianId: string; // Clinician DID or ID
  clinicianDid?: string;
  orgId?: string;
  npi: string;
  state: string;
  licenseNumber: string;
}

export interface PSVOrchestratorResult {
  psvResultId: string;
  clinicianId: string;
  npi: string;
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
  licenseCheck: {
    checkId: string;
    status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED';
    sourceUrl: string;
    checkedAt: string;
  };
  sanctionsCheck: {
    checkId: string;
    sanctioned: boolean;
    sourceUrl: string;
    checkedAt: string;
  };
  isFresh: boolean;
  freshUntil: string;
  checkedAt: string;
  summary: string;
}

/**
 * Mock license check for orchestrator
 * In production, this would call the actual license route internally
 */
async function performLicenseCheck(
  npi: string,
  state: string,
  licenseNumber: string
): Promise<{
  checkId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED';
  sourceUrl: string;
  checkedAt: Date;
}> {
  // Mock data - same as license route
  const MOCK_LICENSES: Record<string, 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED'> = {
    'CA:123456:1234567890': 'ACTIVE',
    'NY:789012:0987654321': 'INACTIVE',
    'TX:555555:1111111111': 'EXPIRED',
    'FL:666666:2222222222': 'SUSPENDED',
  };

  const key = `${state}:${licenseNumber}:${npi}`;
  const status = MOCK_LICENSES[key] || 'ACTIVE';

  const checkedAt = new Date();
  const sourceUrl = `https://stateboard.${state.toLowerCase()}.gov/verify/${licenseNumber}`;

  const licenseCheck = await prisma.pSVLicenseCheck.create({
    data: {
      npi,
      state,
      licenseNumber,
      status,
      sourceUrl,
      checkedAt,
      rawResponse: {
        npi,
        state,
        licenseNumber,
        status,
        sourceUrl,
        timestamp: checkedAt.toISOString(),
      },
      metadata: {
        apiVersion: 'mock-v1',
        checkType: 'state-board',
        orchestrated: true,
      },
    },
  });

  return {
    checkId: licenseCheck.id,
    status,
    sourceUrl,
    checkedAt,
  };
}

/**
 * Mock sanctions check for orchestrator
 * In production, this would call the actual sanctions route internally
 */
async function performSanctionsCheck(
  npi: string
): Promise<{
  checkId: string;
  sanctioned: boolean;
  sourceUrl: string;
  checkedAt: Date;
}> {
  // Mock data - same as sanctions route
  const SANCTIONED_TEST_NPIS = new Set(['6666666666', '7777777777']);
  const sanctioned = SANCTIONED_TEST_NPIS.has(npi);

  const checkedAt = new Date();
  const sourceUrl = 'https://exclusions.oig.hhs.gov/verification.aspx';

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
        timestamp: checkedAt.toISOString(),
      },
      metadata: {
        apiVersion: 'mock-v1',
        checkType: 'oig-leie',
        orchestrated: true,
      },
    },
  });

  return {
    checkId: sanctionsCheck.id,
    sanctioned,
    sourceUrl,
    checkedAt,
  };
}

/**
 * Determine overall PSV status from license and sanctions results
 */
function determineOverallStatus(
  licenseStatus: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED',
  sanctioned: boolean
): 'PASS' | 'FAIL' | 'WARNING' {
  // If sanctioned, always FAIL
  if (sanctioned) {
    return 'FAIL';
  }

  // If license is not ACTIVE, FAIL
  if (licenseStatus !== 'ACTIVE') {
    return 'FAIL';
  }

  // All checks passed
  return 'PASS';
}

/**
 * Generate human-readable summary of PSV result
 */
function generateSummary(
  overallStatus: 'PASS' | 'FAIL' | 'WARNING',
  licenseStatus: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED',
  sanctioned: boolean
): string {
  if (overallStatus === 'PASS') {
    return 'All PSV checks passed. Provider has active license and no sanctions.';
  }

  const issues: string[] = [];
  if (licenseStatus !== 'ACTIVE') {
    issues.push(`License status: ${licenseStatus}`);
  }
  if (sanctioned) {
    issues.push('Provider is on OIG exclusion list');
  }

  return `PSV checks failed. Issues: ${issues.join('; ')}.`;
}

/**
 * Run PSV for a clinician
 *
 * Orchestrates license verification and sanctions check
 * Returns combined result and stores in database
 *
 * @param input - Clinician information and license details
 * @returns Combined PSV result or error object
 */
export async function runPSV(input: PSVOrchestratorInput): Promise<PSVOrchestratorResult | { ok: false; error: string }> {
  const { clinicianId, clinicianDid, orgId, npi, state, licenseNumber } = input;

  // B146A-QA-005: Handle network/API errors from license/sanctions stubs
  let licenseResult;
  let sanctionsResult;

  try {
    licenseResult = await performLicenseCheck(npi, state, licenseNumber);
  } catch (error: any) {
    log.error('[PSV Orchestrator] License check failed:', error);
    return {
      ok: false,
      error: 'PSV_SOURCE_ERROR',
    };
  }

  try {
    sanctionsResult = await performSanctionsCheck(npi);
  } catch (error: any) {
    log.error('[PSV Orchestrator] Sanctions check failed:', error);
    return {
      ok: false,
      error: 'PSV_SOURCE_ERROR',
    };
  }

  // Determine overall status
  const overallStatus = determineOverallStatus(licenseResult.status, sanctionsResult.sanctioned);

  // Calculate freshness (120 days from now)
  const checkedAt = new Date();
  const freshUntil = new Date(checkedAt);
  freshUntil.setDate(freshUntil.getDate() + 120);

  // Generate summary
  const summary = generateSummary(overallStatus, licenseResult.status, sanctionsResult.sanctioned);

  // Store PSV result in database
  const psvResult = await prisma.pSVResult.create({
    data: {
      clinicianId,
      npi,
      licenseCheckId: licenseResult.checkId,
      sanctionsCheckId: sanctionsResult.checkId,
      overallStatus,
      checkedAt,
      isFresh: true,
      freshUntil,
      metadata: {
        summary,
        licenseStatus: licenseResult.status,
        sanctioned: sanctionsResult.sanctioned,
      },
    },
  });

  eventBus.emitEvent('PSVCompleted', {
    psvResultId: psvResult.id,
    clinicianId,
    clinicianDid,
    orgId,
    isFresh: true,
    passed: overallStatus === 'PASS',
    hasSanctions: sanctionsResult.sanctioned,
    summary,
  });

  return {
    psvResultId: psvResult.id,
    clinicianId,
    npi,
    overallStatus,
    licenseCheck: {
      checkId: licenseResult.checkId,
      status: licenseResult.status,
      sourceUrl: licenseResult.sourceUrl,
      checkedAt: licenseResult.checkedAt.toISOString(),
    },
    sanctionsCheck: {
      checkId: sanctionsResult.checkId,
      sanctioned: sanctionsResult.sanctioned,
      sourceUrl: sanctionsResult.sourceUrl,
      checkedAt: sanctionsResult.checkedAt.toISOString(),
    },
    isFresh: true,
    freshUntil: freshUntil.toISOString(),
    checkedAt: checkedAt.toISOString(),
    summary,
  };
}

/**
 * Get PSV result by ID
 */
export async function getPSVResult(psvResultId: string): Promise<PSVOrchestratorResult | null> {
  const psvResult = await prisma.pSVResult.findUnique({
    where: { id: psvResultId },
    include: {
      licenseCheck: true,
      sanctionsCheck: true,
    },
  });

  if (!psvResult) {
    return null;
  }

  const metadata = psvResult.metadata as any;

  return {
    psvResultId: psvResult.id,
    clinicianId: psvResult.clinicianId,
    npi: psvResult.npi || '',
    overallStatus: psvResult.overallStatus as 'PASS' | 'FAIL' | 'WARNING',
    licenseCheck: {
      checkId: psvResult.licenseCheck?.id || '',
      status: (psvResult.licenseCheck?.status as any) || 'ACTIVE',
      sourceUrl: psvResult.licenseCheck?.sourceUrl || '',
      checkedAt: psvResult.licenseCheck?.checkedAt.toISOString() || '',
    },
    sanctionsCheck: {
      checkId: psvResult.sanctionsCheck?.id || '',
      sanctioned: psvResult.sanctionsCheck?.sanctioned || false,
      sourceUrl: psvResult.sanctionsCheck?.sourceUrl || '',
      checkedAt: psvResult.sanctionsCheck?.checkedAt.toISOString() || '',
    },
    isFresh: psvResult.isFresh,
    freshUntil: psvResult.freshUntil.toISOString(),
    checkedAt: psvResult.checkedAt.toISOString(),
    summary: metadata?.summary || '',
  };
}

/**
 * Get PSV results for a clinician
 */
export async function getPSVResultsForClinician(
  clinicianId: string
): Promise<PSVOrchestratorResult[]> {
  const psvResults = await prisma.pSVResult.findMany({
    where: { clinicianId },
    include: {
      licenseCheck: true,
      sanctionsCheck: true,
    },
    orderBy: { checkedAt: 'desc' },
  });

  return psvResults.map((psvResult) => {
    const metadata = psvResult.metadata as any;

    return {
      psvResultId: psvResult.id,
      clinicianId: psvResult.clinicianId,
      npi: psvResult.npi || '',
      overallStatus: psvResult.overallStatus as 'PASS' | 'FAIL' | 'WARNING',
      licenseCheck: {
        checkId: psvResult.licenseCheck?.id || '',
        status: (psvResult.licenseCheck?.status as any) || 'ACTIVE',
        sourceUrl: psvResult.licenseCheck?.sourceUrl || '',
        checkedAt: psvResult.licenseCheck?.checkedAt.toISOString() || '',
      },
      sanctionsCheck: {
        checkId: psvResult.sanctionsCheck?.id || '',
        sanctioned: psvResult.sanctionsCheck?.sanctioned || false,
        sourceUrl: psvResult.sanctionsCheck?.sourceUrl || '',
        checkedAt: psvResult.sanctionsCheck?.checkedAt.toISOString() || '',
      },
      isFresh: psvResult.isFresh,
      freshUntil: psvResult.freshUntil.toISOString(),
      checkedAt: psvResult.checkedAt.toISOString(),
      summary: metadata?.summary || '',
    };
  });
}

/**
 * Enqueue a PSV run for asynchronous processing via the worker.
 */
export async function enqueuePSVRun(
  input: PSVOrchestratorInput
): Promise<{ jobId: string }> {
  const jobId = await enqueueJob('PSV_RUN', input);
  return { jobId };
}
