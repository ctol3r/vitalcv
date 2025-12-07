const log = getServiceLogger('psv/api');
/**
 * B119A-NCQA-006: API Primary-Source verification registry API endpoints
 *
 * Exposes REST API for managing PSV endpoints and querying audit evidence
 */

import express, { Request, Response } from 'express';
import { getPSVRegistry, VerificationType, PrimarySourceEndpoint } from './registry';
import { getServiceLogger } from '../logging/serviceLogger';

const router = express.Router();
const registry = getPSVRegistry();

/**
 * GET /psv/registry/endpoints
 * List all registered PSV endpoints
 */
router.get('/endpoints', (req: Request, res: Response) => {
  try {
    const { verificationType, provider, active } = req.query;
    const endpoints = registry.listEndpoints({
      verificationType: verificationType as VerificationType | undefined,
      provider: provider as string | undefined,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
    });

    res.json({
      endpoints: endpoints.map(e => ({
        id: e.id,
        name: e.name,
        endpoint: e.endpoint,
        method: e.method,
        authType: e.authType,
        verificationTypes: e.verificationTypes,
        description: e.description,
        provider: e.provider,
        active: e.active,
        lastVerified: e.lastVerified,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      })),
      count: endpoints.length,
    });
  } catch (error: any) {
    log.error('PSV endpoints query error:', error);
    res.status(500).json({
      error: 'query_failed',
      error_description: error.message,
    });
  }
});

/**
 * POST /psv/registry/endpoints
 * Register a new PSV endpoint
 */
router.post('/endpoints', (req: Request, res: Response) => {
  try {
    const {
      name,
      endpoint,
      method,
      authType,
      authConfig,
      verificationTypes,
      description,
      provider,
      active,
    } = req.body;

    if (!name || !endpoint || !method || !authType || !verificationTypes || !description || !provider) {
      return res.status(400).json({
        error: 'missing_required_fields',
        error_description: 'name, endpoint, method, authType, verificationTypes, description, and provider are required',
      });
    }

    const registeredEndpoint = registry.registerEndpoint({
      name,
      endpoint,
      method,
      authType,
      authConfig,
      verificationTypes,
      description,
      provider,
      active: active !== false,
    });

    res.status(201).json({
      message: 'PSV endpoint registered',
      endpoint: registeredEndpoint,
    });
  } catch (error: any) {
    log.error('PSV endpoint registration error:', error);
    res.status(500).json({
      error: 'registration_failed',
      error_description: error.message,
    });
  }
});

/**
 * GET /psv/registry/endpoints/:id
 * Get specific PSV endpoint
 */
router.get('/endpoints/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const endpoint = registry.getEndpoint(id);

    if (!endpoint) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }

    res.json({ endpoint });
  } catch (error: any) {
    log.error('PSV endpoint query error:', error);
    res.status(500).json({
      error: 'query_failed',
      error_description: error.message,
    });
  }
});

/**
 * POST /psv/registry/verifications
 * Record a verification request
 */
router.post('/verifications', (req: Request, res: Response) => {
  try {
    const {
      endpointId,
      verificationType,
      subjectId,
      requestPayload,
      responsePayload,
      status,
      durationMs,
    } = req.body;

    if (!endpointId || !verificationType || !subjectId || !status) {
      return res.status(400).json({
        error: 'missing_required_fields',
        error_description: 'endpointId, verificationType, subjectId, and status are required',
      });
    }

    const verification = registry.recordVerification(
      endpointId,
      verificationType,
      subjectId,
      requestPayload || {},
      responsePayload || null,
      status,
      durationMs || null
    );

    res.status(201).json({
      message: 'Verification recorded',
      verification,
    });
  } catch (error: any) {
    log.error('Verification recording error:', error);
    res.status(500).json({
      error: 'recording_failed',
      error_description: error.message,
    });
  }
});

/**
 * GET /psv/registry/verifications
 * Get verification history
 */
router.get('/verifications', (req: Request, res: Response) => {
  try {
    const { endpointId, verificationType, subjectId, status } = req.query;
    const verifications = registry.getVerificationHistory({
      endpointId: endpointId as string | undefined,
      verificationType: verificationType as VerificationType | undefined,
      subjectId: subjectId as string | undefined,
      status: status as any,
    });

    res.json({
      verifications,
      count: verifications.length,
    });
  } catch (error: any) {
    log.error('Verification history query error:', error);
    res.status(500).json({
      error: 'query_failed',
      error_description: error.message,
    });
  }
});

/**
 * GET /psv/registry/audit-evidence
 * Get audit evidence (CR1-CR5)
 */
router.get('/audit-evidence', (req: Request, res: Response) => {
  try {
    const { crType } = req.query;
    const evidence = registry.getAuditEvidence(crType as VerificationType | undefined);

    res.json({
      evidence: evidence.map(e => ({
        crType: e.crType,
        endpointId: e.endpointId,
        endpointName: e.endpointName,
        subjectId: e.subjectId,
        verificationId: e.verificationId,
        timestamp: e.timestamp,
        evidenceHash: e.evidenceHash,
        hasSignOff: e.reviewerSignOff !== null,
        reviewerSignOff: e.reviewerSignOff ? {
          reviewerId: e.reviewerSignOff.reviewerId,
          reviewerName: e.reviewerSignOff.reviewerName,
          signedAt: e.reviewerSignOff.signedAt,
        } : null,
      })),
      count: evidence.length,
    });
  } catch (error: any) {
    log.error('Audit evidence query error:', error);
    res.status(500).json({
      error: 'query_failed',
      error_description: error.message,
    });
  }
});

/**
 * POST /psv/registry/audit-evidence/:verificationId/sign-off
 * Add reviewer sign-off to audit evidence
 */
router.post('/audit-evidence/:verificationId/sign-off', (req: Request, res: Response) => {
  try {
    const { verificationId } = req.params;
    const { reviewerId, reviewerName, signature } = req.body;

    if (!reviewerId || !reviewerName || !signature) {
      return res.status(400).json({
        error: 'missing_required_fields',
        error_description: 'reviewerId, reviewerName, and signature are required',
      });
    }

    const evidence = registry.signOffEvidence(verificationId, reviewerId, reviewerName, signature);

    if (!evidence) {
      return res.status(404).json({ error: 'Verification evidence not found' });
    }

    res.json({
      message: 'Evidence signed off',
      evidence: {
        crType: evidence.crType,
        verificationId: evidence.verificationId,
        reviewerSignOff: evidence.reviewerSignOff,
      },
    });
  } catch (error: any) {
    log.error('Sign-off error:', error);
    res.status(500).json({
      error: 'signoff_failed',
      error_description: error.message,
    });
  }
});

/**
 * GET /psv/registry/statistics
 * Get registry statistics
 */
router.get('/statistics', (req: Request, res: Response) => {
  try {
    const stats = registry.getStatistics();
    res.json(stats);
  } catch (error: any) {
    log.error('Statistics query error:', error);
    res.status(500).json({
      error: 'query_failed',
      error_description: error.message,
    });
  }
});

export default router;

