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
 * • Only PAS + sanitized trust-state summaries leave this service — no raw PII.
 * • Webhook is HMAC-SHA256 signed (X-VitalCV-Signature).
 * • Rate-limited: publicApiRateLimit (100 req / 10 min / IP).
 *
 * PAS TRUTHFULNESS
 * ────────────────
 * PAS is derived from live trust state (computeClinicianTrustState /
 * getCachedTrustState). Mock values are NOT used in production paths.
 * If trust state is unavailable, a conservative RED/0/C is returned.
 */

import { randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import { publicApiRateLimit } from '../middleware/publicSafety';
import {
  getCachedTrustState,
  computeClinicianTrustState,
  type ClinicianTrustState,
  type TrustBand,
} from '../services/trust/trustStateEngine';
import {
  recordCacheLookup,
  recordWidgetPasGenerationTime,
} from '../services/system/pilotTelemetry';
import {
  emitWidgetEvent,
  type WidgetWebhookEvent,
} from '../services/integration/widgetWebhookService';

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

// ── Helpers ───────────────────────────────────────────────────────────────

const WEBHOOK_SECRET =
  process.env.WIDGET_WEBHOOK_SECRET ?? 'dev-secret-change-in-production';

function elapsedMs(startedAtNs: bigint): number {
  return Number(process.hrtime.bigint() - startedAtNs) / 1_000_000;
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

function toNpiPrefix(npi: string): string {
  return `${npi.slice(0, 4)}······`;
}

function buildPasSummary(trustState: ClinicianTrustState): PasSummary {
  const credentialsVerified = (trustState.facts ?? []).filter(
    (fact) => fact.status !== 'expired' && fact.status !== 'unknown',
  ).length;

  return {
    status: bandToStatus(trustState.readiness_level),
    score: trustState.readiness_score,
    band: bandToGrade(trustState.readiness_level),
    as_of: trustState.computedAt,
    credentials_verified: credentialsVerified,
  };
}

function buildFallbackTrustState(npi: string): ClinicianTrustState {
  const computedAt = new Date().toISOString();

  return {
    npi,
    identityVerified: false,
    licensureStatus: 'unknown',
    exclusionClear: false,
    exclusionStatus: 'UNKNOWN',
    credentialCount: 0,
    readiness_level: 'L0',
    readiness_status: 'Unavailable',
    readiness_score: 0,
    gap_summary: ['Trust state unavailable'],
    methodology_version: 'widget-fallback',
    computed_at: computedAt,
    trustBand: 'L0',
    trustScore: 0,
    facts: [],
    gaps: ['Trust state unavailable'],
    computedAt,
  };
}

function sanitizeTrustStateForWebhook(
  npi: string,
  trustState: ClinicianTrustState,
): Omit<ClinicianTrustState, 'npi'> & { npi_prefix: string } {
  const { npi: _npi, ...rest } = trustState;
  return {
    ...rest,
    npi_prefix: toNpiPrefix(npi),
  };
}

export interface BuildLivePasResult {
  pas: PasSummary;
  trustState: ClinicianTrustState;
}

/**
 * Derive a live PAS from the clinician's trust state.
 * Tries the 1-hour cache first; falls back to live computation.
 * If trust state is unavailable, returns a conservative RED/0/C.
 * NEVER returns a hardcoded mock value.
 */
export async function buildLivePasWithTrustState(
  npi: string,
): Promise<BuildLivePasResult> {
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

    recordWidgetPasGenerationTime({
      latencyMs: elapsedMs(startedAtNs),
      cacheStatus,
      outcome: 'success',
    });

    return {
      pas: buildPasSummary(state),
      trustState: state,
    };
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
    const fallbackTrustState = buildFallbackTrustState(npi);
    return {
      pas: buildPasSummary(fallbackTrustState),
      trustState: fallbackTrustState,
    };
  }
}

export async function buildLivePas(npi: string): Promise<PasSummary> {
  const result = await buildLivePasWithTrustState(npi);
  return result.pas;
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
      const webhookUrl   = process.env.WIDGET_ATS_WEBHOOK_URL;

      const fireWidgetEvent = (
        event: WidgetWebhookEvent,
        payload: Record<string, unknown>,
      ): void => {
        void emitWidgetEvent(event, payload, webhookUrl, WEBHOOK_SECRET);
      };

      fireWidgetEvent('candidate.shared', {
        submission_id: submissionId,
        issued_at: issuedAt,
        client_id: clientId,
        org_name: orgName ?? null,
        clinician: {
          npi_prefix: toNpiPrefix(npi),
        },
        consent: {
          granted: true,
          granted_at: issuedAt,
        },
      });

      // ── Derive live PAS from trust state ───────────────────────────────
      const { pas, trustState } = await buildLivePasWithTrustState(npi);

      fireWidgetEvent('passport.verified', {
        submission_id: submissionId,
        issued_at: issuedAt,
        client_id: clientId,
        org_name: orgName ?? null,
        clinician: {
          npi_prefix: toNpiPrefix(npi),
          authority_state: pas,
        },
      });

      fireWidgetEvent('trust_state.ready', {
        submission_id: submissionId,
        issued_at: issuedAt,
        client_id: clientId,
        org_name: orgName ?? null,
        clinician: {
          npi_prefix: toNpiPrefix(npi),
        },
        trust_state: sanitizeTrustStateForWebhook(npi, trustState),
      });

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
        webhook_status: webhookUrl ? 'dispatched' : 'no_ats_configured',
        pas_summary:    pas,
        events_fired: [
          'candidate.shared',
          'passport.verified',
          'trust_state.ready',
        ],
      });
    },
  );
}
