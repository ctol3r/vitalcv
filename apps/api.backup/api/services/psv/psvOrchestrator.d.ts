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
export interface PSVOrchestratorInput {
    clinicianId: string;
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
 * Run PSV for a clinician
 *
 * Orchestrates license verification and sanctions check
 * Returns combined result and stores in database
 *
 * @param input - Clinician information and license details
 * @returns Combined PSV result or error object
 */
export declare function runPSV(input: PSVOrchestratorInput): Promise<PSVOrchestratorResult | {
    ok: false;
    error: string;
}>;
/**
 * Get PSV result by ID
 */
export declare function getPSVResult(psvResultId: string): Promise<PSVOrchestratorResult | null>;
/**
 * Get PSV results for a clinician
 */
export declare function getPSVResultsForClinician(clinicianId: string): Promise<PSVOrchestratorResult[]>;
/**
 * Enqueue a PSV run for asynchronous processing via the worker.
 */
export declare function enqueuePSVRun(input: PSVOrchestratorInput): Promise<{
    jobId: string;
}>;
