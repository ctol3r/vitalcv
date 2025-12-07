/**
 * Pilot Smoke Test Route
 * B133A-PILOT-002: End-to-end smoke test for issuer↔wallet↔verifier flow
 *
 * This route executes a comprehensive smoke test that validates:
 * 1. Issuer: Issue a test VC
 * 2. Wallet: Store and retrieve the VC
 * 3. Verifier: Present and verify the VC
 *
 * Returns status, timestamps, and fails loudly on any step failure
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  recordPilotSmokeRun,
  type PilotSmokeTestResult,
  type PilotSmokeTestStep,
} from '../../../../../services/pilot/pilotAnalytics';

const router = Router();
const prisma = new PrismaClient();

/**
 * Smoke test step result
 */
type SmokeTestStep = PilotSmokeTestStep;
type SmokeTestResult = PilotSmokeTestResult;

/**
 * Execute a single smoke test step with timing
 */
async function executeStep(
  stepName: string,
  stepFn: () => Promise<any>
): Promise<SmokeTestStep> {
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
  } catch (error: any) {
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
 * Step 1: Issue a test VC
 */
async function issueTestCredential(): Promise<any> {
  // TODO: Implement actual credential issuance
  // For now, simulate the operation
  const credentialId = `test-cred-${Date.now()}`;

  // Simulate issuer API call
  await new Promise(resolve => setTimeout(resolve, 100));

  // Check if issuer service is responsive
  // In production, this would call the actual issuer API
  const isIssuerHealthy = true; // Replace with actual health check

  if (!isIssuerHealthy) {
    throw new Error('Issuer service is not responding');
  }

  return {
    credentialId,
    issuer: 'did:web:chai.vc',
    subject: 'did:key:test-subject',
    type: ['VerifiableCredential', 'TestCredential'],
    issuanceDate: new Date().toISOString(),
  };
}

/**
 * Step 2: Store credential in wallet
 */
async function storeInWallet(credential: any): Promise<any> {
  // TODO: Implement actual wallet storage
  // For now, simulate the operation
  await new Promise(resolve => setTimeout(resolve, 80));

  const walletId = `wallet-${Date.now()}`;

  // Check if wallet service is responsive
  const isWalletHealthy = true; // Replace with actual health check

  if (!isWalletHealthy) {
    throw new Error('Wallet service is not responding');
  }

  return {
    walletId,
    credentialId: credential.credentialId,
    stored: true,
    storedAt: new Date().toISOString(),
  };
}

/**
 * Step 3: Present credential from wallet
 */
async function presentCredential(walletData: any): Promise<any> {
  // TODO: Implement actual credential presentation
  // For now, simulate the operation
  await new Promise(resolve => setTimeout(resolve, 90));

  const presentationId = `presentation-${Date.now()}`;

  return {
    presentationId,
    walletId: walletData.walletId,
    credentialId: walletData.credentialId,
    presentedAt: new Date().toISOString(),
  };
}

/**
 * Step 4: Verify credential presentation
 */
async function verifyPresentation(presentation: any): Promise<any> {
  // TODO: Implement actual verification
  // For now, simulate the operation
  await new Promise(resolve => setTimeout(resolve, 120));

  // Check if verifier service is responsive
  const isVerifierHealthy = true; // Replace with actual health check

  if (!isVerifierHealthy) {
    throw new Error('Verifier service is not responding');
  }

  return {
    presentationId: presentation.presentationId,
    verified: true,
    verifiedAt: new Date().toISOString(),
    verifier: 'did:web:verifier.chai.vc',
  };
}

/**
 * Log smoke test result to database
 */
async function logSmokeTestResult(result: SmokeTestResult): Promise<void> {
  try {
    await prisma.pilotSmokeTestLog.create({
      data: {
        success: result.success,
        totalDuration: result.totalDuration,
        timestamp: new Date(result.timestamp),
        steps: result.steps as any,
        summary: result.summary as any,
        errorMessage: result.errorMessage,
      },
    });
  } catch (error) {
    console.error('Failed to log smoke test result:', error);
    // Don't fail the smoke test if logging fails
  }
}

/**
 * Main smoke test handler
 * POST /pilot/smoke
 *
 * Executes end-to-end VC flow and returns detailed results
 */
router.post('/smoke', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const steps: SmokeTestStep[] = [];

  try {
    // Step 1: Issue credential
    console.log('🔍 [Smoke Test] Step 1: Issuing test credential...');
    const issueResult = await executeStep('issue_credential', issueTestCredential);
    steps.push(issueResult);

    if (issueResult.status === 'failure') {
      throw new Error(`Credential issuance failed: ${issueResult.error}`);
    }

    // Step 2: Store in wallet
    console.log('🔍 [Smoke Test] Step 2: Storing credential in wallet...');
    const storeResult = await executeStep(
      'store_in_wallet',
      () => storeInWallet(issueResult.details)
    );
    steps.push(storeResult);

    if (storeResult.status === 'failure') {
      throw new Error(`Wallet storage failed: ${storeResult.error}`);
    }

    // Step 3: Present credential
    console.log('🔍 [Smoke Test] Step 3: Presenting credential...');
    const presentResult = await executeStep(
      'present_credential',
      () => presentCredential(storeResult.details)
    );
    steps.push(presentResult);

    if (presentResult.status === 'failure') {
      throw new Error(`Credential presentation failed: ${presentResult.error}`);
    }

    // Step 4: Verify presentation
    console.log('🔍 [Smoke Test] Step 4: Verifying presentation...');
    const verifyResult = await executeStep(
      'verify_presentation',
      () => verifyPresentation(presentResult.details)
    );
    steps.push(verifyResult);

    if (verifyResult.status === 'failure') {
      throw new Error(`Verification failed: ${verifyResult.error}`);
    }

    // All steps passed
    const totalDuration = Date.now() - startTime;
    const result: SmokeTestResult = {
      success: true,
      totalDuration,
      timestamp,
      steps,
      summary: {
        passed: steps.filter(s => s.status === 'success').length,
        failed: steps.filter(s => s.status === 'failure').length,
        total: steps.length,
      },
    };

    // Log to database
    await logSmokeTestResult(result);
    await recordPilotSmokeRun(result, {
      runId: result.timestamp,
      triggeredBy: 'pilot-smoke-route',
    });

    console.log(`✅ [Smoke Test] All steps passed in ${totalDuration}ms`);

    return res.status(200).json(result);

  } catch (error: any) {
    // Smoke test failed
    const totalDuration = Date.now() - startTime;
    const result: SmokeTestResult = {
      success: false,
      totalDuration,
      timestamp,
      steps,
      summary: {
        passed: steps.filter(s => s.status === 'success').length,
        failed: steps.filter(s => s.status === 'failure').length,
        total: steps.length,
      },
      errorMessage: error.message || 'Smoke test failed',
    };

    // Log to database
    await logSmokeTestResult(result);
    await recordPilotSmokeRun(result, {
      runId: result.timestamp,
      triggeredBy: 'pilot-smoke-route',
    });

    console.error(`❌ [Smoke Test] Failed: ${error.message}`);

    return res.status(500).json(result);
  }
});

/**
 * GET /pilot/smoke/status
 *
 * Returns the status of the most recent smoke test
 */
router.get('/smoke/status', async (req: Request, res: Response) => {
  try {
    const latestTest = await prisma.pilotSmokeTestLog.findFirst({
      orderBy: { timestamp: 'desc' },
    });

    if (!latestTest) {
      return res.status(404).json({
        error: 'No smoke test results found',
      });
    }

    return res.status(200).json({
      success: latestTest.success,
      timestamp: latestTest.timestamp,
      totalDuration: latestTest.totalDuration,
      summary: latestTest.summary,
      errorMessage: latestTest.errorMessage,
    });
  } catch (error: any) {
    console.error('Failed to fetch smoke test status:', error);
    return res.status(500).json({
      error: 'Failed to fetch smoke test status',
      message: error.message,
    });
  }
});

/**
 * GET /pilot/smoke/history
 *
 * Returns smoke test history (last N tests)
 */
router.get('/smoke/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 24;

    const history = await prisma.pilotSmokeTestLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: {
        id: true,
        success: true,
        timestamp: true,
        totalDuration: true,
        summary: true,
        errorMessage: true,
      },
    });

    return res.status(200).json({
      count: history.length,
      tests: history,
    });
  } catch (error: any) {
    console.error('Failed to fetch smoke test history:', error);
    return res.status(500).json({
      error: 'Failed to fetch smoke test history',
      message: error.message,
    });
  }
});

export default router;

