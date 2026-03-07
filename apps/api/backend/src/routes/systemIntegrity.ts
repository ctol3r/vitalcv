/**
 * systemIntegrity.ts — Wave B (salvaged from Wave 58)
 *
 * GET /api/integrity/sweep — full system health check via systemSweep
 * GET /api/integrity/e2e   — end-to-end flow simulation
 */

import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { runSystemSweep } from '../services/integrity/systemSweep';

// ── E2E Flow ──────────────────────────────────────────────────────────────

interface E2EStep {
  step: string;
  status: 'pass' | 'fail';
  message: string;
  durationMs: number;
}

interface E2EReport {
  timestamp: string;
  allPassed: boolean;
  steps: E2EStep[];
  totalDurationMs: number;
}

async function runE2EFlow(): Promise<E2EReport> {
  const steps: E2EStep[] = [];
  const totalStart = Date.now();

  // Step 1: Signup — Clinician model accessible
  {
    const start = Date.now();
    try {
      const count = await prisma.clinicianIdentity.count();
      steps.push({
        step: 'Signup (Clinician Model)',
        status: 'pass',
        message: `Model accessible, ${count} records`,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      steps.push({
        step: 'Signup (Clinician Model)',
        status: 'fail',
        message: err instanceof Error ? err.message : 'Unknown',
        durationMs: Date.now() - start,
      });
    }
  }

  // Step 2: Login — session infrastructure
  {
    const start = Date.now();
    const hasAuth = !!process.env.NEXTAUTH_SECRET && !!process.env.NEXTAUTH_URL;
    steps.push({
      step: 'Login (Session Infrastructure)',
      status: hasAuth ? 'pass' : 'fail',
      message: hasAuth ? 'NextAuth configured' : 'Missing auth env vars',
      durationMs: Date.now() - start,
    });
  }

  // Step 3: Wallet load — credential retrieval
  {
    const start = Date.now();
    try {
      const artifacts = await prisma.verificationArtifact.findMany({ take: 1 });
      steps.push({
        step: 'Wallet Load (Credentials)',
        status: 'pass',
        message: `Artifact query OK (${artifacts.length} sampled)`,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      steps.push({
        step: 'Wallet Load (Credentials)',
        status: 'fail',
        message: err instanceof Error ? err.message : 'Unknown',
        durationMs: Date.now() - start,
      });
    }
  }

  // Step 4: Verifier dashboard — audit events
  {
    const start = Date.now();
    try {
      const events = await prisma.auditEvent.findMany({ take: 1, orderBy: { createdAt: 'desc' } });
      steps.push({
        step: 'Verifier Dashboard (Audit Events)',
        status: 'pass',
        message: `Audit query OK (${events.length} sampled)`,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      steps.push({
        step: 'Verifier Dashboard (Audit Events)',
        status: 'fail',
        message: err instanceof Error ? err.message : 'Unknown',
        durationMs: Date.now() - start,
      });
    }
  }

  // Step 5: Network Explorer — knowledge graph
  {
    const start = Date.now();
    try {
      const nodes = await prisma.knowledgeNode.findMany({ take: 1 });
      steps.push({
        step: 'Network Explorer (Knowledge Graph)',
        status: 'pass',
        message: `KnowledgeNode query OK (${nodes.length} sampled)`,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      steps.push({
        step: 'Network Explorer (Knowledge Graph)',
        status: 'fail',
        message: err instanceof Error ? err.message : 'Unknown',
        durationMs: Date.now() - start,
      });
    }
  }

  return {
    timestamp: new Date().toISOString(),
    allPassed: steps.every((s) => s.status === 'pass'),
    steps,
    totalDurationMs: Date.now() - totalStart,
  };
}

// ── Route Registration ────────────────────────────────────────────────────

export function registerSystemIntegrityRoutes(app: Express): void {
  app.get('/api/integrity/sweep', async (_req: Request, res: Response) => {
    try {
      const report = await runSystemSweep();
      res.status(report.overallStatus === 'critical' ? 503 : 200).json(report);
    } catch (err) {
      res.status(500).json({
        error: 'Sweep failed',
        message: err instanceof Error ? err.message : 'Unknown',
      });
    }
  });

  app.get('/api/integrity/e2e', async (_req: Request, res: Response) => {
    try {
      const report = await runE2EFlow();
      res.status(report.allPassed ? 200 : 503).json(report);
    } catch (err) {
      res.status(500).json({
        error: 'E2E check failed',
        message: err instanceof Error ? err.message : 'Unknown',
      });
    }
  });
}
