/**
 * widget.ts — Wave 34: "Apply with VitalCV" Plaid Wedge
 *
 * POST /api/widget/submit
 *
 * Receives clinician consent from the OIDC4VP popup widget. Derives a
 * Professional Authority State (PAS) summary and dispatches a signed
 * webhook payload to the employer's registered ATS endpoint.
 *
 * SECURITY GUARANTEES
 * ───────────────────
 * • NPI validated (10-digit) before any processing.
 * • Only authority_state summary leaves this service — no PII.
 * • Webhook is HMAC-SHA256 signed (X-VitalCV-Signature).
 * • Rate-limited: publicApiRateLimit (100 req / 10 min / IP).
 *
 * PAS TRUTHFULNESS
 * ────────────────
 * PAS is derived from live trust state (computeClinicianTrustState /
 * getCachedTrustState). Mock values are NOT used in production paths.
 * If trust state is unavailable, a conservative RED/0/C is returned.
 */

import { createHmac, randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import { publicApiRateLimit } from '../middleware/publicSafety';
import {
  getCachedTrustState,
  computeClinicianTrustState,
  type TrustBand,
} from '../services/trust/trustStateEngine';
import {
  recordCacheLookup,
  recordWidgetPasGenerationTime,
} from '../services/system/pilotTelemetry';

// ── Types ─────────────────────────────────────────────────────────────────

interface WidgetSubmitBody {
  clientId:       string;
  npi:            string;
  consentGranted: boolean;
  orgName?:       string;
}

interface PasSummary {
  status:               'GREEN' | 'YELLOW' | 'RED';
  score:                number;
  band:                 'A' | 'B' | 'C';
  as_of:                string;
  credentials_verified: number;
}

interface WebhookPayload {
  schema:        'vitalcv.widget.v1';
  event:         'vitalcv.widget.application_submitted';
  submission_id: string;
  issued_at:     string;
  client_id:     string;
  clinician:     { npi_prefix: string; authority_state: PasSummary };
  consent:       { granted: true; granted_at: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────

const WEBHOOK_SECRET =
  process.env.WIDGET_WEBHOOK_SECRET ?? 'dev-secret-change-in-production';

function elapsedMs(startedAtNs: bigint): number {
  return Number(process.hrtime.bigint() - startedAtNs) / 1_000_000;
}

function signPayload(body: string): string {
  const hmac = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
  return `t=${Date.now()},v1=${hmac}`;
}

/** Map trust band to PAS status */
function bandToStatus(band: TrustBand): PasSummary['status'] {
  if (band === 'L3') return 'GREEN';
  if (band === 'L2') return 'YELLOW';
  return 'RED';
}

/** Map trust band to PAS band grade */
function bandToGrade(band: TrustBand): PasSummary['band'] {
  if (band === 'L3') return 'A';
  if (band === 'L2') return 'B';
  return 'C';
}

/**
 * Derive a live PAS from the clinician's trust state.
 * Tries the 1-hour cache first; falls back to live computation.
 * If trust state is unavailable, returns a conservative RED/0/C.
 * NEVER returns a hardcoded mock value.
 */
export async function buildLivePas(npi: string): Promise<PasSummary> {
  const startedAtNs = process.hrtime.bigint();
  let cacheStatus: 'hit' | 'miss' | 'unknown' = 'unknown';

  try {
    // Try cache first (1-hour TTL)
    let state = await getCachedTrustState(npi);

    if (state) {
      cacheStatus = 'hit';
      recordCacheLookup({ source: 'widget_pas', hit: true });
    }

    // Miss — compute live
    if (!state) {
      cacheStatus = 'miss';
      recordCacheLookup({ source: 'widget_pas', hit: false });
      state = await computeClinicianTrustState(npi);
    }

    const credentialsVerified = (state.facts ?? []).filter(
      (f) => f.status !== 'expired' && f.status !== 'unknown',
    ).length;

    const pasSummary: PasSummary = {
      status:               bandToStatus(state.readiness_level),
      score:                state.readiness_score,
      band:                 bandToGrade(state.readiness_level),
      as_of:                state.computedAt,
      credentials_verified: credentialsVerified,
    };

    recordWidgetPasGenerationTime({
      latencyMs: elapsedMs(startedAtNs),
      cacheStatus,
      outcome: 'success',
    });

    return pasSummary;
  } catch (err) {
    recordWidgetPasGenerationTime({
      latencyMs: elapsedMs(startedAtNs),
      cacheStatus,
      outcome: 'fallback',
    });

    // Conservative fallback — never claim GREEN on error
    log('warn', 'widget_trust_state_failed', {
      npi_prefix: npi.slice(0, 4),
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      status:               'RED',
      score:                0,
      band:                 'C',
      as_of:                new Date().toISOString(),
      credentials_verified: 0,
    };
  }
}

/** Fire-and-forget to ATS webhook — never blocks the 200 response. */
async function dispatchWebhook(
  url: string,
  payload: WebhookPayload,
): Promise<void> {
  const body = JSON.stringify(payload);
  const sig  = signPayload(body);

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':        'application/json',
        'X-VitalCV-Signature': sig,
        'X-VitalCV-Event':     payload.event,
        'User-Agent':          'VitalCV-Widget/1.0',
      },
      body,
      signal: AbortSignal.timeout(5_000),
    });

    log('info', 'widget_webhook_dispatched', {
      url,
      status:        res.status,
      submission_id: payload.submission_id,
    });
  } catch (err) {
    log('warn', 'widget_webhook_dispatch_failed', {
      url,
      message:       err instanceof Error ? err.message : String(err),
      submission_id: payload.submission_id,
    });
  }
}

// ── Route ─────────────────────────────────────────────────────────────────

export function registerWidgetRoutes(app: Express): void {
  /**
   * POST /api/widget/submit
   * Body: { clientId, npi, consentGranted, orgName? }
   */
  app.post(
    '/api/widget/submit',
    publicApiRateLimit,
    async (req: Request, res: Response) => {
      const { clientId, npi, consentGranted, orgName } =
        req.body as WidgetSubmitBody;

      // ── Validation ─────────────────────────────────────────────────────
      if (!clientId || typeof clientId !== 'string') {
        return res.status(400).json({
          error:             'invalid_request',
          error_description: 'clientId is required.',
        });
      }
      if (!npi || !/^\d{10}$/.test(npi)) {
        return res.status(400).json({
          error:             'invalid_request',
          error_description: 'npi must be a 10-digit string.',
        });
      }
      if (consentGranted !== true) {
        return res.status(400).json({
          error:             'consent_required',
          error_description: 'consentGranted must be true.',
        });
      }

      const submissionId = randomUUID();
      const issuedAt     = new Date().toISOString();

      // ── Derive live PAS from trust state ───────────────────────────────
      const pas = await buildLivePas(npi);

      // ── Build signed webhook payload ───────────────────────────────────
      const payload: WebhookPayload = {
        schema:        'vitalcv.widget.v1',
        event:         'vitalcv.widget.application_submitted',
        submission_id: submissionId,
        issued_at:     issuedAt,
        client_id:     clientId,
        clinician: {
          npi_prefix:      npi.slice(0, 4) + '······',
          authority_state: pas,
        },
        consent: { granted: true, granted_at: issuedAt },
      };

      // ── Dispatch (fire-and-forget) ─────────────────────────────────────
      // Production: look up employer's ATS URL from DB via clientId.
      const atsUrl = process.env.WIDGET_ATS_WEBHOOK_URL;
      if (atsUrl) void dispatchWebhook(atsUrl, payload);

      log('info', 'widget_submit', {
        event:         'widget_submit',
        submission_id: submissionId,
        client_id:     clientId,
        org_name:      orgName ?? '(unset)',
        pas_status:    pas.status,
        pas_score:     pas.score,
        pas_band:      pas.band,
      });

      return res.status(200).json({
        ok:             true,
        submission_id:  submissionId,
        issued_at:      issuedAt,
        webhook_status: atsUrl ? 'dispatched' : 'no_ats_configured',
        pas_summary:    pas,
      });
    },
  );
}
