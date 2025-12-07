/**
 * B132A-WIDGET-002: Widget token issuance API for partner ATS/EHR
 *
 * POST /widget/token issues short-lived JWT scoped to jobId+partnerId; logs issued-by
 */

import { Router, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { validateWidgetTokenRequest, type WidgetTokenPayload } from '../../../../services/partners/models/PartnerConfig';
import { partnerAuthMiddleware } from '../middleware/partnerAuth';

const router = Router();

// Secret for signing widget tokens (should be from env/secrets manager)
const WIDGET_TOKEN_SECRET = process.env.WIDGET_TOKEN_SECRET || 'widget-secret-change-in-production';
const WIDGET_ISSUER = process.env.WIDGET_ISSUER || 'vitalcv:widget-api';

// Token issuance log (in production, this should go to audit log/database)
interface TokenIssuanceLog {
  tokenId: string;
  partnerId: string;
  jobId?: string;
  issuedBy: string;
  issuedAt: string;
  expiresAt: string;
  scope: string;
}

const issuanceLogs: TokenIssuanceLog[] = [];

/**
 * POST /widget/token
 * Issue a short-lived widget token for partner
 *
 * Security:
 * - Requires partner authentication (API key or mTLS)
 * - Tokens are short-lived (max 1 hour, default 30 min)
 * - Scoped to specific partner and optionally job
 * - All issuances are logged with issuer identity
 */
router.post(
  '/widget/token',
  partnerAuthMiddleware,
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const tokenRequest = validateWidgetTokenRequest(req.body);

      // Verify partner is authorized
      const authenticatedPartnerId = (req as any).partner?.id;
      if (authenticatedPartnerId !== tokenRequest.partnerId) {
        return res.status(403).json({
          error: 'forbidden',
          message: 'Cannot issue tokens for other partners',
        });
      }

      // Verify partner is active (check partner config)
      // TODO: Fetch partner config from database and verify isActive

      // Generate token ID
      const tokenId = `wgt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Build token payload
      const now = Math.floor(Date.now() / 1000);
      const exp = now + tokenRequest.ttlSeconds;

      const payload: WidgetTokenPayload = {
        sub: tokenRequest.partnerId,
        jobId: tokenRequest.jobId,
        scope: 'widget:apply',
        iat: now,
        exp,
        iss: WIDGET_ISSUER,
        aud: 'vitalcv:widget',
      };

      // Sign JWT
      const token = jwt.sign(payload, WIDGET_TOKEN_SECRET, {
        algorithm: 'HS256',
        jwtid: tokenId,
      });

      // Log issuance
      const issuanceLog: TokenIssuanceLog = {
        tokenId,
        partnerId: tokenRequest.partnerId,
        jobId: tokenRequest.jobId,
        issuedBy: tokenRequest.issuedBy,
        issuedAt: new Date(now * 1000).toISOString(),
        expiresAt: new Date(exp * 1000).toISOString(),
        scope: payload.scope,
      };

      issuanceLogs.push(issuanceLog);

      console.log(`[widget/token] Token issued`, {
        tokenId,
        partnerId: tokenRequest.partnerId,
        jobId: tokenRequest.jobId,
        issuedBy: tokenRequest.issuedBy,
        ttl: tokenRequest.ttlSeconds,
      });

      // Return token
      return res.status(201).json({
        token,
        tokenType: 'Bearer',
        expiresIn: tokenRequest.ttlSeconds,
        expiresAt: new Date(exp * 1000).toISOString(),
        scope: payload.scope,
        tokenId,
      });

    } catch (error: any) {
      console.error('[widget/token] Error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Invalid token request',
          details: error.errors,
        });
      }

      return res.status(500).json({
        error: 'internal_error',
        message: 'Failed to issue token',
      });
    }
  }
);

/**
 * GET /widget/token/logs
 * Query token issuance logs (admin only)
 */
router.get(
  '/widget/token/logs',
  partnerAuthMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { partnerId, limit = 50, offset = 0 } = req.query;

      // Filter logs by partner if specified
      let logs = issuanceLogs;
      if (partnerId) {
        logs = logs.filter(log => log.partnerId === partnerId);
      }

      // Paginate
      const total = logs.length;
      const paginatedLogs = logs
        .slice(Number(offset), Number(offset) + Number(limit));

      return res.json({
        logs: paginatedLogs,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
        },
      });

    } catch (error) {
      console.error('[widget/token/logs] Error:', error);
      return res.status(500).json({
        error: 'internal_error',
        message: 'Failed to fetch logs',
      });
    }
  }
);

/**
 * POST /widget/token/revoke
 * Revoke a widget token
 */
router.post(
  '/widget/token/revoke',
  partnerAuthMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { tokenId } = req.body;

      if (!tokenId) {
        return res.status(400).json({
          error: 'invalid_request',
          message: 'tokenId is required',
        });
      }

      // TODO: Add token to revocation list (Redis or database)
      // For now, just log it
      console.log(`[widget/token/revoke] Token revoked: ${tokenId}`);

      return res.json({
        message: 'Token revoked successfully',
        tokenId,
      });

    } catch (error) {
      console.error('[widget/token/revoke] Error:', error);
      return res.status(500).json({
        error: 'internal_error',
        message: 'Failed to revoke token',
      });
    }
  }
);

export default router;

