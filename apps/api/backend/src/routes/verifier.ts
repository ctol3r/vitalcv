/**
 * verifier.ts — Wave 99: Verifier Acceptance Flow API
 *
 * POST /api/verifier/accept        — Accept and evaluate a credential presentation
 * GET  /api/verifier/reports       — List acceptance reports
 * GET  /api/verifier/reports/:id   — Get a specific acceptance report
 */

import type { Express, Request, Response } from 'express';
import { appendAuditEvent, newTraceId } from '../services/audit/auditLedger';
import { generateVerificationReceipt } from '../services/audit/receiptGenerator';
import {
  acceptCredentialPresentation,
  getAcceptanceReport,
  listAcceptanceReports,
} from '../services/verifier/credentialAcceptance';
import { getPresentation } from '../services/credentials/credentialPresentation';
import { log } from '../obs/logger';
import { requireOrgRole, VERIFIER_MUTATION_ROLES } from '../middleware/orgRoleGuard';

export function registerVerifierAcceptanceRoutes(app: Express): void {

  // ── POST /api/verifier/accept ──────────────────────────────────────
  // RBAC (blocker #2): mutating verifier action — gated by org-role once
  // VERIFIER_RBAC_MODE reaches shadow/enforce. Note this route is also
  // whitelisted from the tenant guard (tenantGuard.ts) — the org-role guard is
  // the authz control here, and inherits the same header-trust caveat until G1.
  app.post('/api/verifier/accept', requireOrgRole(VERIFIER_MUTATION_ROLES), async (req: Request, res: Response) => {
    try {
      const { presentationId, presentation: presentationBody } = req.body ?? {};

      // Resolve presentation — from ID or direct body
      let presentation = null;

      if (presentationId) {
        presentation = getPresentation(presentationId);
        if (!presentation) {
          res.status(404).json({ error: `Presentation ${presentationId} not found` });
          return;
        }
      } else if (presentationBody && typeof presentationBody === 'object') {
        presentation = presentationBody;
      } else {
        res.status(400).json({ error: 'Provide either presentationId or a presentation object' });
        return;
      }

      const report = await acceptCredentialPresentation(presentation);
      const traceId = newTraceId();
      const receipts = (
        await Promise.all(
          report.credentialResults.map((result) =>
            generateVerificationReceipt({
              credentialId: result.credentialId,
              verifier: typeof req.body?.verifierDid === 'string'
                ? req.body.verifierDid
                : 'did:vitalcv:verifier:acceptance',
              subject: result.subject,
              valid: result.valid,
              checks: result.checks,
              haipCompliant: result.errors.every((error) => !error.startsWith('[HAIP:')),
              errors: result.errors,
            }).catch((error) => {
              log('warn', 'verifier_accept_receipt_failed', {
                credentialId: result.credentialId,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
              return null;
            }),
          ),
        )
      ).filter((receipt): receipt is NonNullable<typeof receipt> => receipt !== null);
      const auditEntry = appendAuditEvent({
        traceId,
        category: ['VERIFICATION', 'DECISION'],
        actor: typeof req.body?.verifierDid === 'string'
          ? req.body.verifierDid
          : 'did:vitalcv:verifier:acceptance',
        resource: report.presentationId,
        severity: report.decision === 'ACCEPTED' ? 'INFO' : 'WARNING',
        resultFields: {
          decision: report.decision,
          reportId: report.reportId,
        },
      });

      res.status(200).json({
        report: {
          ...report,
          receiptId: receipts[0]?.receiptId ?? null,
          traceId,
        },
        receiptId: receipts[0]?.receiptId ?? null,
        receiptIds: receipts.map((receipt) => receipt.receiptId),
        receiptHash: receipts[0]?.hash ?? auditEntry.receiptHash,
        traceId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'verifier_accept_failed', { error: msg });
      res.status(500).json({ error: 'Failed to evaluate presentation', detail: msg });
    }
  });

  // ── GET /api/verifier/reports ──────────────────────────────────────
  app.get('/api/verifier/reports', (_req: Request, res: Response) => {
    try {
      const reports = listAcceptanceReports();
      res.status(200).json({ reports, total: reports.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'verifier_reports_list_failed', { error: msg });
      res.status(500).json({ error: 'Failed to list reports', detail: msg });
    }
  });

  // ── GET /api/verifier/reports/:id ─────────────────────────────────
  app.get('/api/verifier/reports/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const report = getAcceptanceReport(id);

      if (!report) {
        res.status(404).json({ error: `Acceptance report ${id} not found` });
        return;
      }

      res.status(200).json({ report });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'verifier_report_get_failed', { error: msg });
      res.status(500).json({ error: 'Failed to retrieve report', detail: msg });
    }
  });
}
