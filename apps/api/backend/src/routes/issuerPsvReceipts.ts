/**
 * ISSUER-10 — the client-safe write boundary for issuer PSV receipts.
 *
 * ISSUER-8 closed the direct path deliberately: importing the Prisma-bound
 * repository into `apps/web/lib/issuer-verification/` would pull server-only
 * code into the client bundle, and the web tests assert that no such import
 * exists. The defer memo names "a client-safe RPC boundary (server action,
 * REST endpoint, or RPC)" as the prerequisite. This is that endpoint.
 *
 * Contract:
 *   - Guarded by a dedicated fail-closed shared secret
 *     (`ISSUER_PSV_RECEIPT_WRITER_SECRET`, sent as `x-issuer-writer-secret`)
 *     plus a rate limit. Deliberately NOT `apiKeyAuth`: that middleware
 *     bypasses entirely outside production when no API_KEYS are configured,
 *     which would leave a truth-artifact write anonymous in every dev and test
 *     environment. With no secret provisioned this route answers 403 to
 *     everyone, including in dev — unreachable until an operator turns it on.
 *   - The route is on the tenant-guard skip list because it is a
 *     service-to-service write with no organization context. It therefore
 *     authenticates itself, and must keep doing so: the skip-list entry is
 *     only safe while the secret check above is the first thing it does.
 *   - Persistence is OFF unless the operator opts in. Two independent signals
 *     are required (ISSUER-9 condition 5): the deployment-level
 *     ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED flag AND the caller's explicit
 *     enableRepositoryWrites intent. Either one alone returns `deferred`.
 *   - A 200 with `persisted: false` is a normal, honest outcome. Callers must
 *     read `persisted`, never infer success from the status code.
 *   - Contract violations return 422 with the offending field named. They are
 *     not retried and not degraded to a partial write.
 */

import type { Express, Request, Response } from 'express';

import { publicApiRateLimit } from '../middleware/publicSafety';
import {
  IssuerPsvReceiptContractError,
  writeIssuerAuditEvent,
  writeIssuerPsvReceipt,
  type IssuerAuditEventWriteInput,
  type IssuerPsvReceiptWriteInput,
} from '../../repositories/issuerPsvReceipts.repo';

/** Deployment-level opt-in. Absent or anything but the literal 'true' = off. */
export function isIssuerPsvReceiptPersistenceEnabled(): boolean {
  return process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED === 'true';
}

export const ISSUER_PSV_RECEIPT_WRITER_PATH = '/api/internal/issuer/psv-receipts';

/**
 * Fail-closed shared-secret check. An unset secret refuses everyone rather
 * than admitting everyone — the inverse of apiKeyAuth's dev bypass, and the
 * reason this route can sit on the tenant-guard skip list safely.
 */
function authorizeWriter(req: Request, res: Response): boolean {
  const expected = process.env.ISSUER_PSV_RECEIPT_WRITER_SECRET?.trim();
  const raw = req.headers['x-issuer-writer-secret'];
  const provided = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;

  if (!expected || !provided || provided !== expected) {
    res.status(403).json({
      error: 'forbidden',
      error_description:
        'A valid x-issuer-writer-secret is required to write an issuer PSV receipt.',
      persisted: false,
    });
    return false;
  }
  return true;
}

interface WriteBody {
  receipt?: IssuerPsvReceiptWriteInput;
  auditEvent?: IssuerAuditEventWriteInput;
  /** Caller's explicit intent. Required in addition to the deployment flag. */
  enableRepositoryWrites?: boolean;
  confirmedBy?: string;
}

const DEFERRED_MESSAGE =
  'Issuer PSV receipt persistence is not enabled in this environment. No row was written.';

export function registerIssuerPsvReceiptRoutes(app: Express): void {
  app.post(
    ISSUER_PSV_RECEIPT_WRITER_PATH,
    publicApiRateLimit,
    async (req: Request, res: Response) => {
      if (!authorizeWriter(req, res)) return;

      const body = (req.body ?? {}) as WriteBody;
      const nowIso = new Date().toISOString();

      if (!body.receipt) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'receipt is required.',
          persisted: false,
        });
      }

      // Both opt-ins must be present. A caller cannot enable persistence on a
      // deployment that has not, and a deployment cannot enable it for a
      // caller that did not ask.
      if (!isIssuerPsvReceiptPersistenceEnabled() || body.enableRepositoryWrites !== true) {
        return res.status(200).json({
          status: 'deferred',
          persisted: false,
          message: DEFERRED_MESSAGE,
        });
      }

      try {
        const confirmation = await writeIssuerPsvReceipt(body.receipt, {
          confirmedBy: body.confirmedBy?.trim() || 'issuer-psv-receipt-route',
          nowIso,
        });

        let auditConfirmation: Awaited<ReturnType<typeof writeIssuerAuditEvent>> | undefined;
        if (body.auditEvent) {
          auditConfirmation = await writeIssuerAuditEvent(body.auditEvent, { nowIso });
        }

        return res.status(200).json({
          status: 'persisted',
          persisted: true,
          confirmation: {
            confirmedAt: confirmation.confirmedAt,
            confirmedBy: confirmation.confirmedBy,
            writerMode: confirmation.writerMode,
            persistedRowId: confirmation.persistedRowId,
            alreadyPersisted: confirmation.alreadyPersisted,
          },
          auditEvent: auditConfirmation
            ? {
                persistedRowId: auditConfirmation.persistedRowId,
                alreadyPersisted: auditConfirmation.alreadyPersisted,
              }
            : undefined,
          message: confirmation.alreadyPersisted
            ? 'An existing row matched the idempotency key; no second row was written.'
            : 'Receipt persisted and read back with every contract field intact.',
        });
      } catch (err) {
        if (err instanceof IssuerPsvReceiptContractError) {
          return res.status(422).json({
            status: 'failed',
            persisted: false,
            failureReason: 'repository_write_failed',
            field: err.field,
            message: err.message,
          });
        }
        return res.status(500).json({
          status: 'failed',
          persisted: false,
          failureReason: 'repository_write_failed',
          message: 'The repository write failed. No persistence is claimed.',
        });
      }
    },
  );
}
