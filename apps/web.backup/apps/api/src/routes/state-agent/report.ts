/**
 * State Agent API Route
 * GET /api/state-agent/report
 *
 * Generates comprehensive system state report for AI agent onboarding.
 * Requires authentication and appropriate role (admin or internal AI agent).
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateStateReport } from '@vitalcv/state-agent';
import { formatAsMarkdown, formatAsJson } from '@vitalcv/state-agent';
import type { StateReportOptions } from '@vitalcv/state-agent';

const router = Router();
const prisma = new PrismaClient();

interface StateAgentRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
}

/**
 * Middleware to check if user is authorized to access state-agent reports
 * Allows: admin, internal AI agents, or users with 'state-agent' role
 */
function requireStateAgentAccess(req: Request, res: Response, next: () => void) {
  const agentReq = req as StateAgentRequest;
  const roles = agentReq.user?.roles || [];
  const isAuthorized =
    roles.includes('admin') ||
    roles.includes('ADMIN') ||
    roles.includes('state-agent') ||
    roles.includes('internal-ai') ||
    // Allow if request has internal AI agent header
    req.headers['x-internal-ai-agent'] === 'true';

  if (!agentReq.user && !req.headers['x-internal-ai-agent']) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'State-agent reports require authentication or internal AI agent header',
    });
  }

  if (!isAuthorized) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: 'State-agent access requires admin, state-agent, or internal-ai role',
    });
  }

  return next();
}

/**
 * GET /api/state-agent/report
 *
 * Query parameters:
 * - format: 'json' | 'markdown' (default: 'json')
 * - includeNarrative: 'true' | 'false' (default: 'true')
 * - complianceLevel: 'strict' | 'standard' | 'minimal' (default: 'standard')
 * - pouRole: string (default: 'Introspection')
 * - waveNumber: number (optional)
 */
router.get('/report', requireStateAgentAccess, async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || 'json';
    const includeNarrative = req.query.includeNarrative !== 'false';
    const complianceLevel = (req.query.complianceLevel as 'strict' | 'standard' | 'minimal') || 'standard';
    const pouRole = (req.query.pouRole as string) || 'Introspection';
    const waveNumber = req.query.waveNumber ? parseInt(req.query.waveNumber as string, 10) : undefined;

    // Get commit hash from query or environment
    let commitHash = req.query.commitHash as string | undefined;
    if (!commitHash) {
      commitHash = process.env.GIT_COMMIT_HASH;
    }

    const options: StateReportOptions = {
      includeNarrative,
      complianceLevel,
      pouRole,
      waveNumber,
      commitHash,
    };

    // Generate state report
    const report = await generateStateReport(prisma, options);

    // Format response based on requested format
    if (format === 'markdown') {
      const markdown = formatAsMarkdown(report);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      return res.send(markdown);
    } else {
      res.setHeader('Content-Type', 'application/json');
      return res.json(report);
    }
  } catch (error) {
    console.error('[state-agent:report] Failed to generate report:', error);
    return res.status(500).json({
      error: 'state_report_generation_failed',
      message: error instanceof Error ? error.message : 'Unexpected error generating state report',
    });
  }
});

export default router;

