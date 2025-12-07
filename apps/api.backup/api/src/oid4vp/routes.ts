/**
 * DC-001, DC-002: OID4VP Routes
 * Routes for presentation request generation and verification
 */

import * as express from 'express';
import { Router } from 'express';
import { createPresentationRequest, getPresentationRequest } from './requestController';
import { verifyPresentation } from './verifyController';
import { PresentationDefinitionService } from './presentationDefinitionService';

const router = Router();

/**
 * POST /api/oid4vp/request
 * Generate a new OID4VP presentation request
 */
router.post('/request', createPresentationRequest);

/**
 * GET /api/oid4vp/request/:sessionId
 * Get presentation request by session ID
 */
router.get('/request/:sessionId', getPresentationRequest);

/**
 * POST /api/oid4vp/verify
 * Verify a VP token returned from a wallet
 */
router.post('/verify', verifyPresentation);

/**
 * POST /api/oid4vp/presentation-definition
 * Save a presentation definition for reuse (DC-003)
 */
router.post('/presentation-definition', async (req, res) => {
  try {
    const { orgId, name, json } = req.body;

    if (!json) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'json field is required',
      });
    }

    const id = await PresentationDefinitionService.save({
      orgId,
      name,
      json,
    });

    res.json({
      id,
      message: 'Presentation definition saved successfully',
    });
  } catch (error) {
    console.error('[OID4VP Save Definition] Error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/oid4vp/presentation-definition/:id
 * Get a presentation definition by ID
 */
router.get('/presentation-definition/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const definition = await PresentationDefinitionService.getById(id);

    if (!definition) {
      return res.status(404).json({
        error: 'not_found',
        error_description: 'Presentation definition not found',
      });
    }

    res.json(definition);
  } catch (error) {
    console.error('[OID4VP Get Definition] Error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/oid4vp/presentation-definition
 * List presentation definitions for an organization
 */
router.get('/presentation-definition', async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'orgId query parameter is required',
      });
    }

    const definitions = await PresentationDefinitionService.listByOrg(orgId);
    res.json(definitions);
  } catch (error) {
    console.error('[OID4VP List Definitions] Error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * DELETE /api/oid4vp/presentation-definition/:id
 * Delete a presentation definition
 */
router.delete('/presentation-definition/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { orgId } = req.query; // Optional: verify ownership

    const deleted = await PresentationDefinitionService.delete(id, orgId as string | undefined);

    if (!deleted) {
      return res.status(404).json({
        error: 'not_found',
        error_description: 'Presentation definition not found or unauthorized',
      });
    }

    res.json({
      message: 'Presentation definition deleted successfully',
    });
  } catch (error) {
    console.error('[OID4VP Delete Definition] Error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;

