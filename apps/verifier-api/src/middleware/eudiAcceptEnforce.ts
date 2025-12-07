/**
 * EUDI Accept Enforcement Middleware
 * B112B-EUDI-019: Server toggle: Accept EUDI Wallets (hard-enforce)
 *
 * When ACCEPT_EUDI_WALLETS_ONLY is enabled, blocks non-EUDI presentations
 * and logs audit reason.
 */

import { NextFunction, Request, Response } from 'express';
import { isEudiOnlyModeEnabled, getAuditReason } from '../../api/config/eudi-wallet';
import { auditLog } from '../services/audit';

/**
 * Check if a presentation is from an EUDI wallet
 *
 * EUDI wallets typically include:
 * - EUDI-specific headers (e.g., X-EUDI-Wallet-Provider)
 * - EUDI format indicators in the presentation
 * - EUDI trust registry references
 */
function isEudiPresentation(req: Request): boolean {
  // Check for EUDI-specific headers
  const eudiProvider = req.headers['x-eudi-wallet-provider'] || req.headers['x-eudi-provider'];
  if (eudiProvider) {
    return true;
  }

  // Check request body for EUDI indicators
  const body = req.body || {};

  // Check for EUDI format indicators
  if (body.format === 'eudi' || body.eudiFormat || body.eudiWallet) {
    return true;
  }

  // Check for EUDI trust registry references
  if (body.trustRegistry && typeof body.trustRegistry === 'string' && body.trustRegistry.includes('eudi')) {
    return true;
  }

  // Check for EUDI-specific credential types
  if (body.credentialTypes && Array.isArray(body.credentialTypes)) {
    const eudiTypes = body.credentialTypes.some((type: string) =>
      type.includes('EUDI') || type.includes('eudi') || type.includes('eu.europa')
    );
    if (eudiTypes) {
      return true;
    }
  }

  // Check presentation payload if present
  if (body.presentation) {
    const presentation = typeof body.presentation === 'string'
      ? JSON.parse(body.presentation)
      : body.presentation;

    if (presentation.type && Array.isArray(presentation.type)) {
      const hasEudiType = presentation.type.some((t: string) =>
        t.includes('EUDI') || t.includes('eudi') || t.includes('eu.europa')
      );
      if (hasEudiType) {
        return true;
      }
    }

    // Check for EUDI-specific context
    if (presentation['@context'] && Array.isArray(presentation['@context'])) {
      const hasEudiContext = presentation['@context'].some((ctx: string) =>
        ctx.includes('eudi') || ctx.includes('eu.europa')
      );
      if (hasEudiContext) {
        return true;
      }
    }
  }

  // Check VP token for EUDI indicators
  if (body.vp_token) {
    try {
      // Decode JWT to check claims
      const parts = body.vp_token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        if (payload.vp && payload.vp.type) {
          const types = Array.isArray(payload.vp.type) ? payload.vp.type : [payload.vp.type];
          if (types.some((t: string) => t.includes('EUDI') || t.includes('eudi'))) {
            return true;
          }
        }
      }
    } catch {
      // Ignore decode errors
    }
  }

  return false;
}

/**
 * Middleware to enforce EUDI-only acceptance when enabled
 *
 * When ACCEPT_EUDI_WALLETS_ONLY is enabled:
 * - Blocks non-EUDI presentations with 403 Forbidden
 * - Logs audit reason for blocked presentations
 */
export async function eudiAcceptEnforce(req: Request, res: Response, next: NextFunction) {
  // Check if EUDI-only mode is enabled
  const eudiOnlyEnabled = await isEudiOnlyModeEnabled();
  if (!eudiOnlyEnabled) {
    // EUDI-only mode not enabled, allow all presentations
    return next();
  }

  // Check if this is an EUDI presentation
  const isEudi = isEudiPresentation(req);

  if (!isEudi) {
    // Non-EUDI presentation blocked
    const userId = (req as any).user?.id || 'anonymous';
    const reason = await getAuditReason();

    // Log audit event with proper audit service
    await auditLog('eudi_presentation_blocked', {
      userId,
      reason,
      path: req.path,
      method: req.method,
      headers: {
        'user-agent': req.headers['user-agent'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
      },
      timestamp: new Date().toISOString(),
    });

    return res.status(403).json({
      error: 'eudi_only_mode',
      message: 'Only EUDI wallet presentations are accepted. Non-EUDI presentations are blocked.',
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  // EUDI presentation allowed, continue
  next();
}

