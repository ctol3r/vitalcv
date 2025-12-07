/**
 * EUDI Wallet Enforcement Middleware
 * B107B-EUDI-022: Server toggle: Accept EUDI Wallets (hard-enforce)
 *
 * Middleware that enforces EUDI-only mode when enabled.
 * Blocks non-EUDI wallet presentations with 403 Forbidden and logs audit reasons.
 */

import { Request, Response, NextFunction } from 'express';
import { isEudiOnlyModeEnabled, getAuditReason } from '../../apps/api/config/eudi-wallet';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Check if a presentation is from an EUDI wallet
 *
 * EUDI wallets are identified by:
 * - Specific DID methods (e.g., did:key with EUDI-specific keys)
 * - EUDI trust registry entries
 * - Presentation metadata indicating EUDI compliance
 *
 * For now, this is a placeholder that checks for EUDI indicators in the request.
 * In production, this should verify against EUDI trust registries.
 */
function isEudiWalletPresentation(req: Request): boolean {
  // Check for EUDI indicators in headers or body
  const eudiIndicator = req.headers['x-eudi-wallet'] ||
                        req.headers['x-wallet-type'] ||
                        (req.body && req.body.walletType);

  if (eudiIndicator === 'eudi' || eudiIndicator === 'EU Digital Identity Wallet') {
    return true;
  }

  // Check DID method in body (if present)
  if (req.body && req.body.presentation) {
    const presentation = req.body.presentation;
    // EUDI wallets typically use specific DID methods or have EUDI-specific metadata
    if (presentation.type?.includes('EUDI') ||
        presentation.holder?.includes('eudi') ||
        presentation['@context']?.includes('eudi')) {
      return true;
    }
  }

  // Check for EUDI-specific credential types
  if (req.body && req.body.credentials) {
    const credentials = Array.isArray(req.body.credentials) ? req.body.credentials : [req.body.credentials];
    for (const cred of credentials) {
      if (cred.type?.includes('EUDI') || cred.issuer?.includes('eudi')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * EUDI Wallet Enforcement Middleware
 *
 * When EUDI-only mode is enabled, this middleware:
 * 1. Checks if the presentation is from an EUDI wallet
 * 2. Blocks non-EUDI presentations with 403 Forbidden
 * 3. Logs audit events for blocked presentations
 */
export function eudiWalletEnforcer(req: Request, res: Response, next: NextFunction) {
  // Skip enforcement if EUDI-only mode is disabled
  if (!isEudiOnlyModeEnabled()) {
    return next();
  }

  // Check if this is a presentation verification request
  // Apply to routes that handle wallet presentations
  const isPresentationRoute =
    req.path.includes('/verifier/presentation') ||
    req.path.includes('/presentation/verify') ||
    req.path.includes('/verify/presentation') ||
    req.method === 'POST' && (req.path.includes('/verify') || req.path.includes('/presentation'));

  if (!isPresentationRoute) {
    return next();
  }

  // Check if presentation is from EUDI wallet
  const isEudi = isEudiWalletPresentation(req);

  if (!isEudi) {
    const auditReason = getAuditReason();
    const reason = `${auditReason} - Wallet type: ${req.headers['x-wallet-type'] || 'unknown'}`;

    // Log audit event (non-blocking)
    prisma.auditEvent.create({
      data: {
        type: 'EUDI_PRESENTATION_BLOCKED',
        data: {
          reason,
          path: req.path,
          method: req.method,
          walletType: req.headers['x-wallet-type'] || 'unknown',
          timestamp: new Date().toISOString(),
        },
      },
    }).catch((err) => {
      console.warn('Failed to log EUDI block audit event:', err);
    });

    return res.status(403).json({
      error: 'eudi_only_mode_enabled',
      error_description: 'Only EUDI wallet presentations are accepted. Non-EUDI presentations are blocked.',
      reason: auditReason,
      blocked: true,
    });
  }

  // EUDI wallet detected - allow request to proceed
  next();
}

