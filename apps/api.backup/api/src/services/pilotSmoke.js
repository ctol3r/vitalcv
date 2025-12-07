"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPilotSmoke = runPilotSmoke;
const client_1 = require("@prisma/client");
const psvOrchestrator_js_1 = require("../../../services/psv/psvOrchestrator.js");
const pilotAnalytics_js_1 = require("../../../../services/pilot/pilotAnalytics.js");
const prisma = new client_1.PrismaClient();
// Demo clinician data
const DEMO_CLINICIAN = {
    did: 'did:key:demo-clinician-smoke-test',
    npi: '1234567890',
    state: 'CA',
    licenseNumber: '123456',
    name: 'Dr. Demo Smoke Test',
    specialty: 'Internal Medicine',
    email: 'demo@smoke-test.local',
};
// Demo organization data
const DEMO_ORG = {
    id: 'demo-org-pilot-smoke',
    name: 'Demo Hospital - Smoke Test',
};
// Demo reviewer data
const DEMO_REVIEWER = {
    did: 'did:key:demo-reviewer-smoke-test',
    name: 'Demo Reviewer',
};
/**
 * Execute a single smoke test step with timing
 */
async function executeStep(stepName, stepFn) {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    try {
        const result = await stepFn();
        const duration = Date.now() - startTime;
        return {
            step: stepName,
            status: 'success',
            duration,
            timestamp,
            details: result,
        };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        return {
            step: stepName,
            status: 'failure',
            duration,
            timestamp,
            error: error.message || 'Unknown error',
            details: error.stack ? { stack: error.stack } : undefined,
        };
    }
}
/**
 * Step 1: Issue ClinicianIdentityVC for demo clinician
 *
 * In production, this would call the actual issuer API.
 * For smoke test, we create a mock VC structure.
 */
async function issueClinicianIdentityVC() {
    // Simulate VC issuance
    await new Promise(resolve => setTimeout(resolve, 100));
    const vcId = `urn:uuid:clinician-vc-${Date.now()}`;
    const issuedAt = new Date().toISOString();
    // Mock VC structure (simplified for smoke test)
    const vc = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        id: vcId,
        type: ['VerifiableCredential', 'ClinicianIdentityCredential'],
        issuer: 'did:web:issuer.vitalcv.com',
        issuanceDate: issuedAt,
        credentialSubject: {
            id: DEMO_CLINICIAN.did,
            npi: DEMO_CLINICIAN.npi,
            name: DEMO_CLINICIAN.name,
            specialty: DEMO_CLINICIAN.specialty,
            email: DEMO_CLINICIAN.email,
        },
    };
    console.log(`✅ [Smoke Test] Issued ClinicianIdentityVC: ${vcId}`);
    return {
        vcId,
        vc,
        clinicianDid: DEMO_CLINICIAN.did,
        npi: DEMO_CLINICIAN.npi,
        issuedAt,
    };
}
/**
 * Step 2: Run PSV stub (license + sanctions check)
 *
 * Uses the existing PSV orchestrator service.
 */
async function runPSVStub(vcResult) {
    console.log(`🔍 [Smoke Test] Running PSV for NPI: ${vcResult.npi}`);
    const psvInput = {
        clinicianId: vcResult.clinicianDid,
        npi: vcResult.npi,
        state: DEMO_CLINICIAN.state,
        licenseNumber: DEMO_CLINICIAN.licenseNumber,
    };
    const psvResult = await (0, psvOrchestrator_js_1.runPSV)(psvInput);
    console.log(`✅ [Smoke Test] PSV completed with status: ${psvResult.overallStatus}`);
    if (psvResult.overallStatus !== 'PASS') {
        throw new Error(`PSV failed with status: ${psvResult.overallStatus}`);
    }
    return {
        psvResultId: psvResult.psvResultId,
        overallStatus: psvResult.overallStatus,
        licenseStatus: psvResult.licenseCheck.status,
        sanctioned: psvResult.sanctionsCheck.sanctioned,
        isFresh: psvResult.isFresh,
        summary: psvResult.summary,
    };
}
/**
 * Step 3: Create PrivilegeRequest
 *
 * Creates a privilege request for the demo clinician at the demo org.
 */
async function createPrivilegeRequest(vcResult, psvResult) {
    console.log(`📋 [Smoke Test] Creating PrivilegeRequest for ${DEMO_CLINICIAN.name}`);
    // Find or create demo privilege set
    let privilegeSet = await prisma.privilegeSet.findFirst({
        where: {
            orgId: DEMO_ORG.id,
            name: 'Demo Core Privileges - Smoke Test',
        },
    });
    if (!privilegeSet) {
        // Create demo privilege set
        privilegeSet = await prisma.privilegeSet.create({
            data: {
                orgId: DEMO_ORG.id,
                name: 'Demo Core Privileges - Smoke Test',
                description: 'Demo privilege set for smoke testing',
                department: 'General',
                procedures: {
                    procedures: [
                        { code: 'P001', name: 'General Medical Care' },
                        { code: 'P002', name: 'Patient Consultation' },
                    ],
                },
                requirements: {
                    minTrainingHours: 100,
                    boardCert: false,
                    licenseActive: true,
                    npdbClean: true,
                    sanctionsClean: true,
                },
                isActive: true,
            },
        });
    }
    // Check for existing pending requests and clean up
    await prisma.privilegeRequest.deleteMany({
        where: {
            clinicianDid: DEMO_CLINICIAN.did,
            privilegeSetId: privilegeSet.id,
            status: {
                in: ['PENDING', 'UNDER_REVIEW'],
            },
        },
    });
    // Create privilege request
    const privilegeRequest = await prisma.privilegeRequest.create({
        data: {
            orgId: DEMO_ORG.id,
            clinicianDid: DEMO_CLINICIAN.did,
            privilegeSetId: privilegeSet.id,
            evidenceIds: [vcResult.vcId, psvResult.psvResultId],
            evidenceBundle: {
                clinicianVC: vcResult.vc,
                psvResult: psvResult,
            },
            status: 'PENDING',
        },
    });
    console.log(`✅ [Smoke Test] Created PrivilegeRequest: ${privilegeRequest.id}`);
    return {
        privilegeRequestId: privilegeRequest.id,
        privilegeSetId: privilegeSet.id,
        status: privilegeRequest.status,
        createdAt: privilegeRequest.createdAt.toISOString(),
    };
}
/**
 * Step 4: Approve PrivilegeRequest and issue PrivilegeGrantedVC
 *
 * Simulates reviewer approval and VC issuance.
 */
async function approvePrivilegeRequest(privilegeRequestResult) {
    console.log(`✅ [Smoke Test] Approving PrivilegeRequest: ${privilegeRequestResult.privilegeRequestId}`);
    const requestId = privilegeRequestResult.privilegeRequestId;
    // Fetch the privilege request
    const privilegeRequest = await prisma.privilegeRequest.findUnique({
        where: { id: requestId },
        include: { privilegeSet: true },
    });
    if (!privilegeRequest) {
        throw new Error('PrivilegeRequest not found');
    }
    // Check if already granted
    const existingGrant = await prisma.privilegeGranted.findUnique({
        where: { privilegeRequestId: requestId },
    });
    if (existingGrant) {
        // Already granted, just return it
        console.log(`ℹ️ [Smoke Test] Privilege already granted: ${existingGrant.id}`);
        return {
            privilegeGrantedId: existingGrant.id,
            status: existingGrant.status,
            grantedAt: existingGrant.grantedAt.toISOString(),
            expiresAt: existingGrant.expiresAt.toISOString(),
            alreadyGranted: true,
        };
    }
    // Update request to approved
    await prisma.privilegeRequest.update({
        where: { id: requestId },
        data: {
            status: 'APPROVED',
            reviewerDid: DEMO_REVIEWER.did,
            reviewNotes: 'Approved via automated smoke test',
            reviewedAt: new Date(),
        },
    });
    // Calculate expiration (2 years from now)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 2);
    // Create PrivilegeGranted record
    const privilegeGranted = await prisma.privilegeGranted.create({
        data: {
            privilegeRequestId: requestId,
            orgId: privilegeRequest.orgId,
            clinicianDid: privilegeRequest.clinicianDid,
            privilegeSetId: privilegeRequest.privilegeSetId,
            vcHash: `hash-${Date.now()}`,
            vcCredentialId: `urn:uuid:privilege-vc-${Date.now()}`,
            status: 'ACTIVE',
            grantedAt: new Date(),
            expiresAt,
        },
    });
    console.log(`✅ [Smoke Test] Created PrivilegeGranted: ${privilegeGranted.id}`);
    return {
        privilegeGrantedId: privilegeGranted.id,
        status: privilegeGranted.status,
        grantedAt: privilegeGranted.grantedAt.toISOString(),
        expiresAt: privilegeGranted.expiresAt.toISOString(),
        vcCredentialId: privilegeGranted.vcCredentialId,
    };
}
/**
 * Main smoke test orchestrator
 *
 * Runs the complete issue→PSV→privilege flow.
 * Returns detailed results with step-by-step status.
 */
async function runPilotSmoke() {
    const startTime = Date.now();
    const startedAt = new Date().toISOString();
    const steps = [];
    console.log('🔍 [Pilot Smoke Test] Starting full flow test...');
    try {
        // Step 1: Issue ClinicianIdentityVC
        const vcStep = await executeStep('issue_clinician_identity_vc', issueClinicianIdentityVC);
        steps.push(vcStep);
        if (vcStep.status === 'failure') {
            throw new Error(`Step 1 failed: ${vcStep.error}`);
        }
        // Step 2: Run PSV
        const psvStep = await executeStep('run_psv_stub', () => runPSVStub(vcStep.details));
        steps.push(psvStep);
        if (psvStep.status === 'failure') {
            throw new Error(`Step 2 failed: ${psvStep.error}`);
        }
        // Step 3: Create PrivilegeRequest
        const privilegeRequestStep = await executeStep('create_privilege_request', () => createPrivilegeRequest(vcStep.details, psvStep.details));
        steps.push(privilegeRequestStep);
        if (privilegeRequestStep.status === 'failure') {
            throw new Error(`Step 3 failed: ${privilegeRequestStep.error}`);
        }
        // Step 4: Approve PrivilegeRequest
        const approvalStep = await executeStep('approve_privilege_request', () => approvePrivilegeRequest(privilegeRequestStep.details));
        steps.push(approvalStep);
        if (approvalStep.status === 'failure') {
            throw new Error(`Step 4 failed: ${approvalStep.error}`);
        }
        // All steps passed
        const finishedAt = new Date().toISOString();
        const totalDuration = Date.now() - startTime;
        console.log(`✅ [Pilot Smoke Test] All steps passed in ${totalDuration}ms`);
        const result = {
            ok: true,
            steps,
            startedAt,
            finishedAt,
            totalDuration,
        };
        await (0, pilotAnalytics_js_1.recordPilotSmokeRun)({
            orgId: DEMO_ORG.id,
            ok: true,
            totalDuration,
            startedAt,
            finishedAt,
        });
        return result;
    }
    catch (error) {
        const finishedAt = new Date().toISOString();
        const totalDuration = Date.now() - startTime;
        const errorMessage = error.message || 'Smoke test failed';
        console.error(`❌ [Pilot Smoke Test] Failed: ${errorMessage}`);
        const result = {
            ok: false,
            steps,
            startedAt,
            finishedAt,
            totalDuration,
            errorMessage,
        };
        await (0, pilotAnalytics_js_1.recordPilotSmokeRun)({
            orgId: DEMO_ORG.id,
            ok: false,
            totalDuration,
            startedAt,
            finishedAt,
            errorMessage,
        });
        return result;
    }
}
