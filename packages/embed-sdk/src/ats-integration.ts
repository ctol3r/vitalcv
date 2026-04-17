// ── VitalCV ATS & HRIS Embed Strategy ──────────────────────────────
// Defines how VitalCV integrates directly into external systems like
// Workday, iCIMS, Symplr, and proprietary credentialing tools.

export enum EmbedMode {
  /** The fastest integration: drops the VitalCV UI directly into an ATS tab */
  IFRAME = 'iframe',
  /** The cleanest integration: ATS calls the API and renders natively */
  API_DRIVEN = 'api_driven',
  /** Asynchronous integration: VitalCV pushes state changes via webhooks */
  WEBHOOK = 'webhook',
}

export interface EmbedConfig {
  /** Target ATS/HRIS platform */
  targetSystem: string;
  /** Integration depth */
  mode: EmbedMode;
  /** The surface where VitalCV appears */
  surface: 'candidate_profile' | 'credential_review' | 'offer_approval';
}

// ── 1. Iframe Embed (Fastest Time-to-Value) ──────────────────────

/**
 * URL for embedding VitalCV into an iframe inside an ATS.
 * Automatically strips nav/footers and optimizes for tight spaces.
 * 
 * Example URL:
 * https://vitalcv.com/embed/p/1487664858?theme=light&hideActions=true
 */
export function getEmbedUrl(npi: string, options?: { hideActions?: boolean; theme?: 'light'|'dark' }): string {
  const params = new URLSearchParams();
  if (options?.hideActions) params.set('readonly', 'true');
  if (options?.theme) params.set('theme', options.theme);
  
  return `https://vitalcv.com/embed/p/${npi}?${params.toString()}`;
}

// ── 2. API-Driven Embed (Cleanest UX) ────────────────────────────

/**
 * For deep integrations, the ATS calls the Universal API to fetch the Manifest
 * and renders the decision data natively within its own UI.
 * 
 * Request:
 * GET /api/v1/manifest/1487664858
 * Authorization: Bearer <ATS_API_KEY>
 * 
 * Response: The complete ProofManifest object (defined in manifest-engine.ts).
 * The ATS should render the `readinessPosture` and `nbaRecommendation` natively.
 */

// ── 3. Webhook Integration (Asynchronous) ────────────────────────

export enum WebhookEvent {
  MANIFEST_GENERATED = 'manifest.generated',
  DRIFT_DETECTED = 'drift.detected',
  DECISION_GRADE_REACHED = 'readiness.decision_grade',
}

export interface WebhookPayload {
  eventId: string;
  eventType: WebhookEvent;
  subjectNpi: string;
  timestamp: string;
  manifestId: string;
  /** Subset of the manifest for immediate routing/filtering */
  summary: {
    posture: string;
    hasAdverseSignals: boolean;
  };
}

/**
 * When VitalCV detects a change (e.g. a new exclusion or a completed sync),
 * it fires a webhook to the ATS. The ATS can then automatically advance
 * the candidate to the Offer stage or flag them for review.
 */
export function buildWebhookPayload(event: WebhookEvent, npi: string, manifestId: string, posture: string, hasAdverse: boolean): WebhookPayload {
  return {
    eventId: crypto.randomUUID(),
    eventType: event,
    subjectNpi: npi,
    timestamp: new Date().toISOString(),
    manifestId,
    summary: { posture, hasAdverseSignals: hasAdverse },
  };
}
