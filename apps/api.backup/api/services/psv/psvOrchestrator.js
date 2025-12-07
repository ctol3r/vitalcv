"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPSV = runPSV;
exports.getPSVResult = getPSVResult;
exports.getPSVResultsForClinician = getPSVResultsForClinician;
exports.enqueuePSVRun = enqueuePSVRun;
const client_1 = require("@prisma/client");
const eventBus_1 = require("../../backend/src/services/notifications/eventBus");
const producer_js_1 = require("../queue/producer.js");
const prisma = new client_1.PrismaClient();
/**
 * Mock license check for orchestrator
 * In production, this would call the actual license route internally
 */
async function performLicenseCheck(npi, state, licenseNumber) {
    // Mock data - same as license route
    const MOCK_LICENSES = {
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
async function performSanctionsCheck(npi) {
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
function determineOverallStatus(licenseStatus, sanctioned) {
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
function generateSummary(overallStatus, licenseStatus, sanctioned) {
    if (overallStatus === 'PASS') {
        return 'All PSV checks passed. Provider has active license and no sanctions.';
    }
    const issues = [];
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
async function runPSV(input) {
    const { clinicianId, clinicianDid, orgId, npi, state, licenseNumber } = input;
    // B146A-QA-005: Handle network/API errors from license/sanctions stubs
    let licenseResult;
    let sanctionsResult;
    try {
        licenseResult = await performLicenseCheck(npi, state, licenseNumber);
    }
    catch (error) {
        console.error('[PSV Orchestrator] License check failed:', error);
        return {
            ok: false,
            error: 'PSV_SOURCE_ERROR',
        };
    }
    try {
        sanctionsResult = await performSanctionsCheck(npi);
    }
    catch (error) {
        console.error('[PSV Orchestrator] Sanctions check failed:', error);
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
    eventBus_1.eventBus.emitEvent('PSVCompleted', {
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
async function getPSVResult(psvResultId) {
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
    const metadata = psvResult.metadata;
    return {
        psvResultId: psvResult.id,
        clinicianId: psvResult.clinicianId,
        npi: psvResult.npi || '',
        overallStatus: psvResult.overallStatus,
        licenseCheck: {
            checkId: psvResult.licenseCheck?.id || '',
            status: psvResult.licenseCheck?.status || 'ACTIVE',
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
async function getPSVResultsForClinician(clinicianId) {
    const psvResults = await prisma.pSVResult.findMany({
        where: { clinicianId },
        include: {
            licenseCheck: true,
            sanctionsCheck: true,
        },
        orderBy: { checkedAt: 'desc' },
    });
    return psvResults.map((psvResult) => {
        const metadata = psvResult.metadata;
        return {
            psvResultId: psvResult.id,
            clinicianId: psvResult.clinicianId,
            npi: psvResult.npi || '',
            overallStatus: psvResult.overallStatus,
            licenseCheck: {
                checkId: psvResult.licenseCheck?.id || '',
                status: psvResult.licenseCheck?.status || 'ACTIVE',
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
async function enqueuePSVRun(input) {
    const jobId = await (0, producer_js_1.enqueueJob)('PSV_RUN', input);
    return { jobId };
}
