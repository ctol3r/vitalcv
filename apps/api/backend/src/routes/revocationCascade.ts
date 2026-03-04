import type { Express, Request, Response } from 'express';
import { enforceOrganizationMatch } from '../middleware/tenantGuard';
import { log } from '../obs/logger';
import {
  CredentialNotFoundError,
  revocationCascadeEngine,
} from '../services/revocation/cascadeEngine';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseCredentialId(rawCredentialId: unknown): string | null {
  if (typeof rawCredentialId !== 'string') {
    return null;
  }

  const credentialId = rawCredentialId.trim();
  if (credentialId.length === 0 || !UUID_RE.test(credentialId)) {
    return null;
  }

  return credentialId;
}

async function loadScopedCascadeReport(
  req: Request,
  res: Response,
): Promise<Awaited<ReturnType<typeof revocationCascadeEngine.generateRevocationCascadeReport>> | null> {
  const credentialId = parseCredentialId(req.params.credentialId);
  if (!credentialId) {
    res.status(400).json({ error: 'credentialId must be a valid UUID.' });
    return null;
  }

  try {
    const scope = await revocationCascadeEngine.resolveCredentialScope(credentialId);

    if (!scope.organizationId) {
      res.status(404).json({
        error: 'not_found',
        error_description: `VerificationArtifact ${credentialId} not found.`,
      });
      return null;
    }

    if (!enforceOrganizationMatch(req, res, scope.organizationId)) {
      return null;
    }

    return await revocationCascadeEngine.generateRevocationCascadeReport(scope);
  } catch (error) {
    if (error instanceof CredentialNotFoundError) {
      res.status(404).json({
        error: 'not_found',
        error_description: error.message,
      });
      return null;
    }

    throw error;
  }
}

export function registerRevocationCascadeRoutes(app: Express): void {
  app.get('/api/revocation/cascade/:credentialId', async (req: Request, res: Response) => {
    try {
      const report = await loadScopedCascadeReport(req, res);
      if (!report) {
        return;
      }

      log('info', 'revocation_cascade_report_generated', {
        credentialId: `${report.credentialId.slice(0, 8)}...`,
        impactedDecisionCount: report.impactedDecisions.length,
        impactedEmployerCount: report.impactedEmployers.length,
        impactedDeploymentCount: report.impactedDeployments.length,
      });

      res.status(200).json(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'revocation_cascade_report_failed', { error: message });
      res.status(500).json({ error: 'Failed to generate revocation cascade report.' });
    }
  });

  app.get('/api/decisions/blast-radius/:credentialId', async (req: Request, res: Response) => {
    try {
      const report = await loadScopedCascadeReport(req, res);
      if (!report) {
        return;
      }

      const legacyResult = revocationCascadeEngine.buildLegacyBlastRadius(report);
      log('info', 'revocation_cascade_legacy_blast_radius_generated', {
        credentialId: `${report.credentialId.slice(0, 8)}...`,
        totalImpacted: legacyResult.totalImpacted,
      });

      res.status(200).json(legacyResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'revocation_cascade_legacy_blast_radius_failed', { error: message });
      res.status(500).json({ error: 'Failed to compute blast radius.' });
    }
  });
}
