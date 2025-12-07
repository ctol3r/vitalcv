/**
 * S72-D3-B-001: Pilot Smoke Test Service
 *
 * Runs complete issue→PSV→privilege flow in-process for demo/smoke testing.
 * This service orchestrates the entire pilot workflow:
 * 1. Issue ClinicianIdentityVC for demo clinician
 * 2. Run PSV stub (license + sanctions check)
 * 3. Create PrivilegeRequest and approve it
 *
 * Returns {ok: boolean, steps: [], startedAt, finishedAt, errorMessage?}
 */
/**
 * Step result interface
 */
export interface SmokeTestStep {
    step: string;
    status: 'success' | 'failure';
    duration: number;
    timestamp: string;
    error?: string;
    details?: Record<string, any>;
}
/**
 * Overall smoke test result
 */
export interface PilotSmokeResult {
    ok: boolean;
    steps: SmokeTestStep[];
    startedAt: string;
    finishedAt: string;
    totalDuration: number;
    errorMessage?: string;
}
/**
 * Main smoke test orchestrator
 *
 * Runs the complete issue→PSV→privilege flow.
 * Returns detailed results with step-by-step status.
 */
export declare function runPilotSmoke(): Promise<PilotSmokeResult>;
