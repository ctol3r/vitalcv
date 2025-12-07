/**
 * B121C-FHIR-021: FHIR pipeline compliance dashboard endpoint
 *
 * Endpoint aggregates pipeline freshness; auth via OIDC4VP
 *
 * Acceptance Criteria:
 * - endpoint aggregates pipeline freshness
 * - auth via OIDC4VP
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const fhirDashboardRouter = Router();

/**
 * Middleware to extract OIDC4VP presentation token and verify
 * In production, this would validate the VP token and extract user claims
 */
async function oidc4vpAuth(req: Request, res: Response, next: Function) {
  // Extract VP token from Authorization header or body
  const authHeader = req.headers.authorization;
  const vpToken = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : req.body?.vp_token;

  if (!vpToken) {
    return res.status(401).json({
      error: 'unauthorized',
      error_description: 'OIDC4VP presentation token required',
      error_hint: 'Include VP token in Authorization header (Bearer <token>) or body (vp_token)',
    });
  }

  // TODO: In production, verify VP token signature and extract claims
  // For now, we'll accept any token and extract basic info
  // In production: verify signature, check expiration, extract user DID/roles

  // Attach user info to request (mock for now)
  (req as any).user = {
    did: 'did:example:user',
    roles: ['compliance_viewer'],
    verified: true,
  };

  next();
}

/**
 * Calculate freshness percentage for FHIR pipeline runs
 * Freshness = (runs within freshness window) / (total runs) * 100
 */
function calculateFreshness(runs: Array<{ finishedAt: Date | null; status: string }>, windowDays: number = 30): number {
  if (runs.length === 0) return 0;

  const now = Date.now();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  const freshRuns = runs.filter(run => {
    if (!run.finishedAt || run.status !== 'ok') return false;
    const ageMs = now - new Date(run.finishedAt).getTime();
    return ageMs < windowMs;
  });

  return (freshRuns.length / runs.length) * 100;
}

/**
 * GET /compliance/fhir/dashboard
 *
 * Returns aggregated FHIR pipeline freshness metrics
 *
 * Response:
 * {
 *   freshness: {
 *     percentage: number,
 *     totalRuns: number,
 *     freshRuns: number,
 *     staleRuns: number,
 *     windowDays: number,
 *   },
 *   verificationCount: number,
 *   recentRuns: Array<{ id, npi, status, finishedAt, agentName }>,
 *   timestamp: string
 * }
 */
fhirDashboardRouter.get('/compliance/fhir/dashboard', oidc4vpAuth, async (req: Request, res: Response) => {
  try {
    const windowDays = parseInt(req.query.windowDays as string) || 30;

    // Get all FHIR-related agent runs
    const fhirRuns = await prisma.agentRun.findMany({
      where: {
        agentName: {
          contains: 'FHIR',
          mode: 'insensitive',
        },
      },
      orderBy: {
        finishedAt: 'desc',
      },
      take: 1000, // Limit to recent runs for performance
    });

    // Calculate freshness metrics
    const totalRuns = fhirRuns.length;
    const freshRuns = fhirRuns.filter(run => {
      if (!run.finishedAt || run.status !== 'ok') return false;
      const ageMs = Date.now() - new Date(run.finishedAt).getTime();
      const windowMs = windowDays * 24 * 60 * 60 * 1000;
      return ageMs < windowMs;
    }).length;
    const staleRuns = totalRuns - freshRuns;
    const freshnessPercentage = totalRuns > 0 ? (freshRuns / totalRuns) * 100 : 0;

    // Count successful verifications (runs with status 'ok')
    const verificationCount = fhirRuns.filter(run => run.status === 'ok').length;

    // Get recent runs (last 20)
    const recentRuns = fhirRuns.slice(0, 20).map(run => ({
      id: run.id,
      npi: run.npi,
      status: run.status,
      finishedAt: run.finishedAt ? new Date(run.finishedAt).toISOString() : null,
      agentName: run.agentName,
      startedAt: run.startedAt ? new Date(run.startedAt).toISOString() : null,
    }));

    // Group by NPI for provider-level metrics
    const runsByNpi = new Map<string, typeof fhirRuns>();
    fhirRuns.forEach(run => {
      if (run.npi) {
        if (!runsByNpi.has(run.npi)) {
          runsByNpi.set(run.npi, []);
        }
        runsByNpi.get(run.npi)!.push(run);
      }
    });

    // Calculate provider-level freshness
    const providerMetrics = Array.from(runsByNpi.entries()).map(([npi, runs]) => {
      const providerFreshness = calculateFreshness(runs, windowDays);
      return {
        npi,
        freshness: providerFreshness,
        totalRuns: runs.length,
        freshRuns: runs.filter(r => {
          if (!r.finishedAt || r.status !== 'ok') return false;
          const ageMs = Date.now() - new Date(r.finishedAt).getTime();
          return ageMs < windowDays * 24 * 60 * 60 * 1000;
        }).length,
        lastRunAt: runs[0]?.finishedAt ? new Date(runs[0].finishedAt).toISOString() : null,
      };
    });

    res.json({
      freshness: {
        percentage: Math.round(freshnessPercentage * 100) / 100,
        totalRuns,
        freshRuns,
        staleRuns,
        windowDays,
      },
      verificationCount,
      recentRuns,
      providerMetrics: providerMetrics.slice(0, 50), // Limit to top 50 providers
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('FHIR dashboard error:', error);
    res.status(500).json({
      error: 'dashboard_calculation_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /compliance/fhir/dashboard/:npi
 *
 * Returns FHIR pipeline freshness for a specific provider
 *
 * Response:
 * {
 *   npi: string,
 *   freshness: {
 *     percentage: number,
 *     totalRuns: number,
 *     freshRuns: number,
 *     staleRuns: number,
 *     windowDays: number,
 *   },
 *   verificationCount: number,
 *   recentRuns: Array<{ id, status, finishedAt, agentName }>,
 *   timestamp: string
 * }
 */
fhirDashboardRouter.get('/compliance/fhir/dashboard/:npi', oidc4vpAuth, async (req: Request, res: Response) => {
  try {
    const { npi } = req.params;
    const windowDays = parseInt(req.query.windowDays as string) || 30;

    if (!npi || !/^\d{10}$/.test(npi)) {
      return res.status(400).json({
        error: 'invalid_npi',
        error_description: 'NPI must be a 10-digit number',
      });
    }

    // Get FHIR runs for this NPI
    const fhirRuns = await prisma.agentRun.findMany({
      where: {
        npi: npi,
        agentName: {
          contains: 'FHIR',
          mode: 'insensitive',
        },
      },
      orderBy: {
        finishedAt: 'desc',
      },
    });

    // Calculate freshness metrics
    const totalRuns = fhirRuns.length;
    const freshRuns = fhirRuns.filter(run => {
      if (!run.finishedAt || run.status !== 'ok') return false;
      const ageMs = Date.now() - new Date(run.finishedAt).getTime();
      const windowMs = windowDays * 24 * 60 * 60 * 1000;
      return ageMs < windowMs;
    }).length;
    const staleRuns = totalRuns - freshRuns;
    const freshnessPercentage = totalRuns > 0 ? (freshRuns / totalRuns) * 100 : 0;

    // Count successful verifications
    const verificationCount = fhirRuns.filter(run => run.status === 'ok').length;

    // Get recent runs
    const recentRuns = fhirRuns.slice(0, 20).map(run => ({
      id: run.id,
      status: run.status,
      finishedAt: run.finishedAt ? new Date(run.finishedAt).toISOString() : null,
      agentName: run.agentName,
      startedAt: run.startedAt ? new Date(run.startedAt).toISOString() : null,
    }));

    res.json({
      npi,
      freshness: {
        percentage: Math.round(freshnessPercentage * 100) / 100,
        totalRuns,
        freshRuns,
        staleRuns,
        windowDays,
      },
      verificationCount,
      recentRuns,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('FHIR dashboard NPI error:', error);
    res.status(500).json({
      error: 'dashboard_calculation_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

