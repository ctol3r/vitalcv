/**
 * resolveEmployerApplicationContext — server-side resolver for the
 * employer review route at /employer/review/[applicationId].
 *
 * Today applicationId === bundleId at the backend boundary. This
 * resolver fetches the bundle and composes an ApplicationSnapshotSummary
 * plus a deep-link to the canonical entityId-based /review surface when
 * one is available. The employer stub page renders the summary directly
 * (never duplicating ReviewClient) and invites the reviewer to continue
 * into the full review flow via that deep link.
 *
 * Doctrine:
 *   - Never synthesize a proof tier. Always route through
 *     resolveProofTier with inputs derived from the bundle.
 *   - Never claim head-start acceptance is allowed unless the tier
 *     says so — we carry `acceptAllowed` through unchanged.
 *   - Never rewrite applicationId. The caller's identifier is the
 *     reader's receipt.
 */
import {
  resolveProofTier,
  type ProofTier,
} from '@/lib/trust/employer-action-consequence';
import { canonicalCredStatus } from '@/lib/trust/status-language';
import { buildEmployerReviewHref } from '@/lib/trust/public-wedge-parity';
import {
  buildApplicationSnapshotSummary,
  type ApplicationLaneSummary,
  type ApplicationSnapshotSummary,
} from '@/lib/apply/application-snapshot';
import { resolveApplicationProgress } from '@/lib/apply/application-progress';

// ── Types ────────────────────────────────────────────────────────────────────

interface ApplyBundleCredential {
  type: string;
  issuer: string;
  status: string;
  verifiedAt: string | null;
  expiresAt: string | null;
}

interface ApplyBundleShape {
  bundleId: string;
  entityId?: string | null;
  npi: string;
  clinicianName: string;
  trustState: {
    readiness_level: string;
    readiness_score: number;
    readiness_status: string;
    computed_at: string;
  };
  credentials: ApplyBundleCredential[];
  generatedAt: string;
  expiresAt: string;
  signature: string;
  // Optional employer-side lifecycle markers. When the backend starts
  // persisting these they are honored; until then they remain undefined
  // and progress stays at the initial `submitted` stage.
  viewedAt?: string | null;
  inReviewAt?: string | null;
  refreshRequestedAt?: string | null;
  manualReviewOpenedAt?: string | null;
  advancedAt?: string | null;
  credentialingStartedAt?: string | null;
  approvedAt?: string | null;
  startReadyAt?: string | null;
  startedAt?: string | null;
}

export type EmployerApplicationContextResult =
  | { ok: true; context: EmployerApplicationContext }
  | { ok: false; reason: 'expired' | 'not_found' | 'error' };

export interface EmployerApplicationContext {
  applicationId: string;
  npi: string;
  clinicianName: string;
  summary: ApplicationSnapshotSummary;
  /**
   * Deep link into the canonical entityId-based /review surface. null
   * when the bundle does not carry an entityId (legacy bundles).
   */
  canonicalReviewHref: string | null;
  /** Raw bundle expiration; UI uses it to show the countdown. */
  expiresAt: string;
}

export interface ResolveInput {
  applicationId: string;
  backendUrl: string;
  /** Optional injection point for tests. */
  fetchImpl?: typeof fetch;
}

// ── Mapping helpers ──────────────────────────────────────────────────────────

const DRAFT_READINESS_LEVELS = new Set(['L0', 'l0']);
const PARTIAL_READINESS_LEVELS = new Set(['L1', 'l1', 'L2', 'l2']);
const DECISION_READINESS_LEVELS = new Set(['L3', 'l3']);

/**
 * Bridge between the backend `readiness_level` scale (L0–L3) and the
 * canonical ProofTier used by the review surface. Conservative by
 * design — unknowns collapse to draft_snapshot so we never claim
 * decision-grade without evidence.
 */
export function readinessLevelToProofTier(level: string): ProofTier {
  if (DECISION_READINESS_LEVELS.has(level)) return 'decision_grade_proof_pack';
  if (PARTIAL_READINESS_LEVELS.has(level)) return 'partial_proof_pack';
  if (DRAFT_READINESS_LEVELS.has(level)) return 'draft_snapshot';
  return 'draft_snapshot';
}

const CREDENTIAL_TYPE_LABELS: Record<string, string> = {
  DEA_LICENSE: 'DEA License',
  STATE_LICENSE: 'State License',
  BOARD_CERT: 'Board Certification',
  NPI_IDENTITY: 'NPI Identity',
  NPPES_IDENTITY: 'NPPES Identity',
  OIG_EXCLUSION: 'OIG / LEIE clear',
  EDUCATION: 'Education',
  MALPRACTICE: 'Malpractice Insurance',
  CANDIDATE_CREDENTIAL: 'Self-reported',
  PSV_RESULT: 'Primary Source Verification',
  APPLY_BUNDLE: 'Bundle',
};

function credentialTypeLabel(type: string): string {
  return CREDENTIAL_TYPE_LABELS[type] ?? type.replace(/_/g, ' ');
}

interface LaneBucket {
  included: ApplicationLaneSummary[];
  omitted: ApplicationLaneSummary[];
  blockerKeys: string[];
}

const INCLUDED_STATUSES = new Set(['Source-backed', 'Checked', 'Active']);
const OMITTED_STATUSES = new Set([
  'Pending',
  'Access required',
  'Stale',
  'Unavailable',
  'Review required',
  'Not decision-grade',
]);

/**
 * Partition credentials into included / omitted / blocker-producing.
 * A credential is INCLUDED only when the canonical status is strong
 * enough to rely on. Everything else is surfaced as OMITTED so the
 * employer reads a truthful coverage list, not an optimistic one.
 */
export function bucketLanesFromCredentials(
  credentials: ApplyBundleCredential[],
): LaneBucket {
  const included: ApplicationLaneSummary[] = [];
  const omitted: ApplicationLaneSummary[] = [];
  const blockerKeys = new Set<string>();

  for (const cred of credentials) {
    const label = credentialTypeLabel(cred.type);
    const status = canonicalCredStatus(cred.status);
    if (INCLUDED_STATUSES.has(status)) {
      included.push({ label });
      continue;
    }

    if (OMITTED_STATUSES.has(status)) {
      omitted.push({ label, qualifier: status });
      if (status === 'Stale') blockerKeys.add('Source reported stale data');
      if (status === 'Unavailable') blockerKeys.add('Source call failed — transient');
      if (status === 'Access required') blockerKeys.add('State board access required');
      if (status === 'Review required') blockerKeys.add('Reviewer must evaluate this finding');
      continue;
    }

    // Unrecognized statuses fall into omitted — we never pretend
    // coverage we cannot verify from the status vocabulary.
    omitted.push({ label, qualifier: status });
  }

  return {
    included,
    omitted,
    blockerKeys: [...blockerKeys],
  };
}

/**
 * Resolve the employer-side context for an applicationId. Called by
 * the server component at /employer/review/[applicationId].
 */
export async function resolveEmployerApplicationContext(
  input: ResolveInput,
): Promise<EmployerApplicationContextResult> {
  const fetchFn = input.fetchImpl ?? fetch;
  const trimmedBackend = input.backendUrl.replace(/\/$/, '');
  const url = `${trimmedBackend}/api/apply/bundle/${encodeURIComponent(input.applicationId)}`;

  let bundle: ApplyBundleShape;
  try {
    const res = await fetchFn(url, { cache: 'no-store' });
    if (res.status === 410) return { ok: false, reason: 'expired' };
    if (res.status === 404) return { ok: false, reason: 'not_found' };
    if (!res.ok) return { ok: false, reason: 'error' };
    bundle = (await res.json()) as ApplyBundleShape;
  } catch {
    return { ok: false, reason: 'error' };
  }

  if (new Date(bundle.expiresAt).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  const proofTier = readinessLevelToProofTier(bundle.trustState.readiness_level);
  const bucket = bucketLanesFromCredentials(bundle.credentials);

  const proofTierMeta = resolveProofTier({
    hasAnchor: proofTier !== 'draft_snapshot',
    allRequiredLanesResolved: bucket.omitted.length === 0,
    hasUnresolvedBlockers: bucket.blockerKeys.length > 0,
    anyLanePending: bucket.omitted.some((l) => l.qualifier === 'Pending'),
    anyLaneReviewRequired: bucket.omitted.some((l) => l.qualifier === 'Review required'),
    anyLaneAccessRequired: bucket.omitted.some((l) => l.qualifier === 'Access required'),
    anyLaneUnavailable: bucket.omitted.some((l) => l.qualifier === 'Unavailable'),
    anyLaneStale: bucket.omitted.some((l) => l.qualifier === 'Stale'),
    anyLaneNoRecord: false,
  });

  const progressStage = resolveApplicationProgress({
    proofTier,
    submittedAt: bundle.generatedAt,
    viewedAt: bundle.viewedAt ?? null,
    inReviewAt: bundle.inReviewAt ?? null,
    refreshRequestedAt: bundle.refreshRequestedAt ?? null,
    manualReviewOpenedAt: bundle.manualReviewOpenedAt ?? null,
    advancedAt: bundle.advancedAt ?? null,
    credentialingStartedAt: bundle.credentialingStartedAt ?? null,
    approvedAt: bundle.approvedAt ?? null,
    startReadyAt: bundle.startReadyAt ?? null,
    startedAt: bundle.startedAt ?? null,
  });

  const summary = buildApplicationSnapshotSummary({
    applicationId: bundle.bundleId,
    proofTier,
    proofTierMeta,
    includedLanes: bucket.included,
    omittedLanes: bucket.omitted,
    blockerKeys: bucket.blockerKeys,
    progressStage,
    submittedAt: bundle.generatedAt,
  });

  const canonicalReviewHref =
    typeof bundle.entityId === 'string' && bundle.entityId.trim().length > 0
      ? buildEmployerReviewHref(bundle.entityId.trim(), { bundleId: bundle.bundleId })
      : null;

  return {
    ok: true,
    context: {
      applicationId: bundle.bundleId,
      npi: bundle.npi,
      clinicianName: bundle.clinicianName,
      summary,
      canonicalReviewHref,
      expiresAt: bundle.expiresAt,
    },
  };
}
