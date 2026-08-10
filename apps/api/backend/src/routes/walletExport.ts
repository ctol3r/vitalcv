/**
 * walletExport.ts — Wave 154: Wallet Interoperability Bridge API Routes
 *
 * POST /api/credentials/export/wallet
 *   Body: { subject, credentialIds[], exportType }
 *   exportType: chapi_vpr_request | chapi_store_payload |
 *               smart_health_card_file | smart_health_card_deeplink |
 *               smart_health_card_qr_payload
 */

import type { Express, Request, Response } from 'express';
import {
  createPresentationRequest,
  createStorePayload,
} from '../services/credentials/chapiBridge';
import {
  exportSmartHealthCardFile,
  exportSmartHealthDeepLink,
  exportSmartHealthQrPayload,
} from '../services/credentials/smartHealthCards';
import { log } from '../obs/logger';
import { requireInternalSecret } from '../middleware/internalSecret';

type WalletExportType =
  | 'chapi_vpr_request'
  | 'chapi_store_payload'
  | 'smart_health_card_file'
  | 'smart_health_card_deeplink'
  | 'smart_health_card_qr_payload';

const VALID_EXPORT_TYPES = new Set<WalletExportType>([
  'chapi_vpr_request',
  'chapi_store_payload',
  'smart_health_card_file',
  'smart_health_card_deeplink',
  'smart_health_card_qr_payload',
]);

/**
 * AUTHORIZATION (2026-08-08). Reachable by any anonymous caller who set
 * `x-org-id` to any value — behind the global tenant guard, which accepted the
 * mere PRESENCE of a caller-supplied org id, and this handler never reads it.
 * It takes `subject` and `credentialIds` straight from the body and builds a
 * wallet payload (SMART Health Card / CHAPI) for them, so it is a read of
 * another subject's credentials wearing a POST.
 *
 * Operator secret: no caller exists anywhere in the repo — the only reference
 * to this path is its own OpenAPI entry.
 */
export function registerWalletExportRoutes(app: Express): void {
  app.post('/api/credentials/export/wallet', requireInternalSecret, (req: Request, res: Response) => {
    try {
      const { subject, credentialIds, exportType, reason, domain } = req.body as {
        subject?: string;
        credentialIds?: string[];
        exportType?: string;
        reason?: string;
        domain?: string;
      };

      if (!exportType || !VALID_EXPORT_TYPES.has(exportType as WalletExportType)) {
        res.status(400).json({
          error: `Invalid exportType. Must be one of: ${[...VALID_EXPORT_TYPES].join(', ')}`,
        });
        return;
      }

      switch (exportType as WalletExportType) {
        case 'chapi_vpr_request': {
          const result = createPresentationRequest({
            reason: reason ?? 'Credential verification request',
            domain,
          });
          res.json({ exportType, data: result });
          return;
        }

        case 'chapi_store_payload': {
          if (!subject || !Array.isArray(credentialIds)) {
            res.status(400).json({ error: 'chapi_store_payload requires subject and credentialIds[]' });
            return;
          }
          const result = createStorePayload({ subject, credentialIds, domain });
          res.json({ exportType, data: result });
          return;
        }

        case 'smart_health_card_file': {
          if (!subject || !Array.isArray(credentialIds)) {
            res.status(400).json({ error: 'smart_health_card_file requires subject and credentialIds[]' });
            return;
          }
          const result = exportSmartHealthCardFile({ subject, credentialIds });
          res.json({ exportType, data: result });
          return;
        }

        case 'smart_health_card_deeplink': {
          if (!subject || !Array.isArray(credentialIds)) {
            res.status(400).json({ error: 'smart_health_card_deeplink requires subject and credentialIds[]' });
            return;
          }
          const result = exportSmartHealthDeepLink({ subject, credentialIds });
          res.json({ exportType, data: result });
          return;
        }

        case 'smart_health_card_qr_payload': {
          if (!subject || !Array.isArray(credentialIds)) {
            res.status(400).json({ error: 'smart_health_card_qr_payload requires subject and credentialIds[]' });
            return;
          }
          const result = exportSmartHealthQrPayload({ subject, credentialIds });
          res.json({ exportType, data: result });
          return;
        }

        default:
          res.status(400).json({ error: 'Unsupported exportType' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log('error', 'wallet_export_route_error', { error: message });

      if (message.includes('disabled')) {
        res.status(403).json({ error: message });
        return;
      }
      res.status(500).json({ error: 'Wallet export failed' });
    }
  });
}
