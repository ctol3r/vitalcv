// @ts-nocheck
/**
 * applyShareService.ts — Apply-with-VitalCV: Sign & Share event system
 *
 * Implements the full share pipeline:
 *   1. Validate organization_context (id, name, callback_url, purpose_of_use)
 *   2. Generate (or reuse) the clinician's apply bundle
 *   3. Persist a BundleShareEvent — structured log of who/what/where/when
 *   4. Dispatch webhook to organization (if registered in EmployerWebhookConfig)
 *   5. Email fallback if no webhook or webhook fails
 *   6. Return structured ShareResult
 *
 * Revocation:
 *   revokeShare(shareId, clerkUserId) marks the share as revoked.
 *   The public bundle view should check BundleShareEvent.revokedAt.
 */

import { createHash, createHmac, randomUUID } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { generateApplyBundle, type ApplyBundle } from './applyBundle';
import { appendAuditEvent } from '../audit/auditLedger';
import { buildEmployerReviewPayload, employerReviewPayloadToJson } from '../entity/employerReviewPayload';
import { issueReadinessSnapshot } from './readinessSnapshotService';
import { getNotificationProvider } from '../providers/notificationProvider';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrganizationContext {
  /** Stable identifier for the organization (employer system ID or slug) */
  organization_id: string;
  /** Human-readable name shown in provider confirmation UI */
  name: string;
  /** Optional: URL the org wants to receive the bundle at */
  callback_url?: string;
  /** Why this share is happening — shown to provider */
  purpose_of_use: string;
}

export interface ShareResult {
  success: boolean;
  shareId: string;
  bundleId: string;
  recipient: {
    organization_id: string;
    name: string;
  };
  /** delivered | email_fallback | logged_only */
  status: 'delivered' | 'email_fallback' | 'logged_only';
  sharedAt: string;
  expiresAt: string;
  bundleUrl: string;
  webhookDelivered: boolean;
  emailSent: boolean;
  /** Wave M — the persisted reusable readiness snapshot issued with this share (null until the migration deploys or when no canonical coverage exists). */
  readinessSnapshotId: string | null;
  readinessSnapshotPath: string | null;
}

export interface ShareListEntry {
  shareId: string;
  organizationId: string;
  organizationName: string;
  purposeOfUse: string;
  sharedAt: string;
  expiresAt: string;
  webhookStatus: string;
  emailFallbackSent: boolean;
  revoked: boolean;
  revokedAt: string | null;
  bundleUrl: string;
}

// ── Validation ────────────────────────────────────────────────────────────────

const URL_RE = /^https?:\/\/.+/;
const NPI_RE = /^\d{10}$/;

export function validateOrganizationContext(ctx: unknown): OrganizationContext {
  if (!ctx || typeof ctx !== 'object') {
    throw new ShareValidationError('organization_context is required.');
  }
  const c = ctx as Record<string, unknown>;
  const id = String(c.organization_id ?? '').trim();
  const name = String(c.name ?? '').trim();
  const purpose = String(c.purpose_of_use ?? '').trim();
  const callbackUrl = c.callback_url ? String(c.callback_url).trim() : undefined;

  if (!id) throw new ShareValidationError('organization_context.organization_id is required.');
  if (id.length > 256) throw new ShareValidationError('organization_context.organization_id too long.');
  if (!name) throw new ShareValidationError('organization_context.name is required.');
  if (name.length > 256) throw new ShareValidationError('organization_context.name too long.');
  if (!purpose) throw new ShareValidationError('organization_context.purpose_of_use is required.');
  if (purpose.length > 512) throw new ShareValidationError('organization_context.purpose_of_use too long.');
  if (callbackUrl && !URL_RE.test(callbackUrl)) {
    throw new ShareValidationError('organization_context.callback_url must be a valid https:// URL.');
  }

  return { organization_id: id, name, purpose_of_use: purpose, callback_url: callbackUrl };
}

export class ShareValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ShareValidationError';
  }
}

// ── Webhook dispatch ──────────────────────────────────────────────────────────

const WEBHOOK_TIMEOUT_MS = 8_000;

interface WebhookDispatchResult {
  delivered: boolean;
  webhookUrl: string | null;
  error: string | null;
  deliveredAt: string | null;
}

async function dispatchToOrganization(
  organizationId: string,
  bundle: ApplyBundle,
  orgContext: OrganizationContext,
  shareId: string,
): Promise<WebhookDispatchResult> {
  // 1. Check EmployerWebhookConfig (existing enterprise webhook table)
  const config = await prisma.employerWebhookConfig.findUnique({
    where: { employerId: organizationId },
    select: { webhookUrl: true, signingSecret: true, active: true },
  }).catch(() => null);

  // 2. Fallback: check callback_url passed in context
  const webhookUrl = (config?.active ? config.webhookUrl : null) ?? orgContext.callback_url ?? null;

  if (!webhookUrl) {
    return { delivered: false, webhookUrl: null, error: null, deliveredAt: null };
  }

  const signingSecret = config?.signingSecret ?? process.env.APPLY_WEBHOOK_DEFAULT_SECRET ?? 'vcv-default-secret';

  const payload = {
    schema: 'vitalcv.apply.share.v1',
    event: 'bundle.shared',
    delivery_id: randomUUID(),
    issued_at: new Date().toISOString(),
    share_id: shareId,
    organization: {
      id: orgContext.organization_id,
      name: orgContext.name,
      purpose_of_use: orgContext.purpose_of_use,
    },
    bundle: {
      bundle_id: bundle.bundleId,
      bundle_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://vitalcv.com'}/apply/${bundle.bundleId}`,
      npi: bundle.npi,
      clinician_name: bundle.clinicianName,
      readiness_level: bundle.trustState.readiness_level,
      readiness_score: bundle.trustState.readiness_score,
      credential_count: bundle.credentials.length,
      expires_at: bundle.expiresAt,
      signature: bundle.signature,
    },
  };

  const body = JSON.stringify(payload);
  const ts = Date.now();
  const sig = createHmac('sha256', signingSecret).update(`t=${ts}${body}`).digest('hex');

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VitalCV-Signature': `t=${ts},v1=${sig}`,
        'X-VitalCV-Event': 'bundle.shared',
        'X-VitalCV-Delivery': payload.delivery_id,
        'User-Agent': 'VitalCV-ApplyWebhook/1.0',
      },
      body,
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    if (!res.ok) {
      return {
        delivered: false,
        webhookUrl,
        error: `HTTP ${res.status} ${res.statusText}`,
        deliveredAt: null,
      };
    }

    return { delivered: true, webhookUrl, error: null, deliveredAt: new Date().toISOString() };
  } catch (err) {
    return {
      delivered: false,
      webhookUrl,
      error: err instanceof Error ? err.message : String(err),
      deliveredAt: null,
    };
  }
}

// ── Email fallback ────────────────────────────────────────────────────────────

async function sendEmailFallback(
  bundle: ApplyBundle,
  orgContext: OrganizationContext,
  shareId: string,
): Promise<{ sent: boolean; to: string | null }> {
  // Derive recipient email: callback_url domain contact, or configured fallback
  const fallbackEmail = process.env.APPLY_EMAIL_FALLBACK_TO ?? null;
  if (!fallbackEmail) {
    log('info', 'apply_share_email_fallback_skipped', {
      shareId,
      reason: 'APPLY_EMAIL_FALLBACK_TO not configured',
    });
    return { sent: false, to: null };
  }

  const bundleUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://vitalcv.com'}/apply/${bundle.bundleId}`;
  const subject = `[VitalCV] Credential bundle shared by ${bundle.clinicianName}`;
  const body = [
    `Organization: ${orgContext.name} (${orgContext.organization_id})`,
    `Purpose of use: ${orgContext.purpose_of_use}`,
    ``,
    `${bundle.clinicianName} (NPI: ${bundle.npi}) has shared their verified credential bundle with your organization.`,
    ``,
    `Readiness: ${bundle.trustState.readiness_level} — ${bundle.trustState.readiness_status} (${bundle.trustState.readiness_score}/100)`,
    `Credentials included: ${bundle.credentials.length}`,
    ``,
    `View bundle: ${bundleUrl}`,
    `Expires: ${new Date(bundle.expiresAt).toUTCString()}`,
    ``,
    `Share ID: ${shareId}`,
    `This bundle is cryptographically signed. Verify at /api/apply/verify.`,
  ].join('\n');

  try {
    const provider = getNotificationProvider();
    await provider.send(fallbackEmail, subject, body);
    return { sent: true, to: fallbackEmail };
  } catch (err) {
    log('warn', 'apply_share_email_fallback_error', { shareId, error: String(err) });
    return { sent: false, to: null };
  }
}

// ── Core: shareBundle ─────────────────────────────────────────────────────────

export async function shareBundle(
  npi: string,
  clerkUserId: string,
  orgContext: OrganizationContext,
  options?: { selectiveClaims?: string[] },
): Promise<ShareResult> {
  if (!NPI_RE.test(npi)) throw new ShareValidationError('npi must be a 10-digit NPI.');
  if (!clerkUserId?.trim()) throw new ShareValidationError('clerkUserId is required.');

  log('info', 'apply_share_start', {
    npi,
    clerkUserId,
    organizationId: orgContext.organization_id,
    purposeOfUse: orgContext.purpose_of_use,
  });

  // 1. Generate bundle (creates VerificationArtifact)
  const bundle = await generateApplyBundle(npi, { selectiveClaims: options?.selectiveClaims });
  const subjectEntity = await prisma.vcvEntity.findFirst({
    where: { npi },
    select: { id: true },
  });
  const reviewPayload = subjectEntity
    ? await buildEmployerReviewPayload({
        entityId: subjectEntity.id,
        sharedByUserId: clerkUserId,
        selectiveDomains: options?.selectiveClaims,
      })
    : null;

  // 2. Dispatch webhook
  const webhookResult = await dispatchToOrganization(
    orgContext.organization_id,
    bundle,
    orgContext,
    bundle.bundleId,   // share ID = bundle ID for now (1:1 at creation)
  );

  // 3. Email fallback — send if webhook failed or was skipped
  let emailResult = { sent: false, to: null as string | null };
  if (!webhookResult.delivered) {
    emailResult = await sendEmailFallback(bundle, orgContext, bundle.bundleId);
  }

  // 4. Determine status
  let status: ShareResult['status'];
  if (webhookResult.delivered) {
    status = 'delivered';
  } else if (emailResult.sent) {
    status = 'email_fallback';
  } else {
    status = 'logged_only';
  }

  // 4.5 Issue the persisted readiness snapshot (Wave M) — the reusable
  // evidence artifact this share travels with. Only issued when the
  // canonical review payload exists (no payload → no coverage to snapshot).
  // Deploy-order safe: degrades to null and the share proceeds unchanged.
  const issuedSnapshot = reviewPayload
    ? await issueReadinessSnapshot({
        npi,
        entityId: subjectEntity?.id ?? null,
        bundleId: bundle.bundleId,
        scope: {
          organizationId: orgContext.organization_id,
          organizationName: orgContext.name,
          purposeOfUse: orgContext.purpose_of_use,
        },
        readiness: {
          level: reviewPayload.readinessSummary.level,
          score: reviewPayload.readinessSummary.score,
          status: reviewPayload.readinessSummary.status,
          checkedAt: reviewPayload.checkedAt,
        },
        sourceCoverage: reviewPayload.sourceCoverage,
      })
    : null;

  // 5. Persist BundleShareEvent
  const credentialsSummary = bundle.credentials.map((c) => ({
    type: c.type,
    status: c.status,
    issuer: c.issuer,
  }));

  const shareRecord = await prisma.bundleShareEvent.create({
    data: {
      id: randomUUID(),
      bundleId: bundle.bundleId,
      npi,
      sharedByClerkUserId: clerkUserId,
      organizationId: orgContext.organization_id,
      organizationName: orgContext.name,
      callbackUrl: orgContext.callback_url ?? null,
      purposeOfUse: orgContext.purpose_of_use,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      credentialsSummary: credentialsSummary as any,
      webhookUrl: webhookResult.webhookUrl ?? null,
      webhookStatus: webhookResult.delivered ? 'DELIVERED' : webhookResult.webhookUrl ? 'FAILED' : 'SKIPPED',
      webhookDeliveredAt: webhookResult.deliveredAt ? new Date(webhookResult.deliveredAt) : null,
      webhookError: webhookResult.error ?? null,
      emailFallbackSent: emailResult.sent,
      emailFallbackTo: emailResult.to ?? null,
      subjectEntityId: subjectEntity?.id ?? null,
      deliveryStatus: webhookResult.delivered
        ? 'DELIVERED'
        : emailResult.sent
          ? 'MANUAL_FALLBACK'
          : 'FAILED',
      checkedAt: reviewPayload ? new Date(reviewPayload.checkedAt) : new Date(),
      bundlePayload: reviewPayload
        ? ({
            ...(employerReviewPayloadToJson(reviewPayload) as Record<string, unknown>),
            // Wave M: the same evidence travels — reviewers can open the
            // persisted snapshot this share was issued with.
            readinessSnapshotId: issuedSnapshot?.snapshotId ?? null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)
        : undefined,
      receiptRefs: reviewPayload?.receiptReferences ?? [],
      sourceCoverage: reviewPayload ? employerReviewPayloadToJson(reviewPayload.sourceCoverage) : undefined,
      expiresAt: new Date(bundle.expiresAt),
    },
  });

  // 6. Emit structured audit event
  appendAuditEvent({
    category: ['BUNDLE_EXPORT'],
    actor: clerkUserId,
    resource: shareRecord.id,
    requestFields: {
      npi,
      organizationId: orgContext.organization_id,
      organizationName: orgContext.name,
      purposeOfUse: orgContext.purpose_of_use,
      credentialCount: bundle.credentials.length,
      selectiveClaims: options?.selectiveClaims,
    },
    resultFields: {
      shareId: shareRecord.id,
      bundleId: bundle.bundleId,
      status,
      webhookDelivered: webhookResult.delivered,
      emailSent: emailResult.sent,
      expiresAt: bundle.expiresAt,
    },
    severity: 'INFO',
  });

  log('info', 'apply_share_complete', {
    shareId: shareRecord.id,
    bundleId: bundle.bundleId,
    npi,
    status,
    webhookDelivered: webhookResult.delivered,
    emailSent: emailResult.sent,
  });

  const bundleUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://vitalcv.com'}/apply/${bundle.bundleId}`;

  return {
    success: true,
    shareId: shareRecord.id,
    bundleId: bundle.bundleId,
    recipient: {
      organization_id: orgContext.organization_id,
      name: orgContext.name,
    },
    status,
    sharedAt: shareRecord.sharedAt.toISOString(),
    expiresAt: bundle.expiresAt,
    bundleUrl,
    webhookDelivered: webhookResult.delivered,
    emailSent: emailResult.sent,
    readinessSnapshotId: issuedSnapshot?.snapshotId ?? null,
    readinessSnapshotPath: issuedSnapshot ? `/snapshot/${issuedSnapshot.snapshotId}` : null,
  };
}

// ── Core: list shares for a clinician ────────────────────────────────────────

export async function listSharesForNpi(npi: string): Promise<ShareListEntry[]> {
  const shares = await prisma.bundleShareEvent.findMany({
    where: { npi },
    orderBy: { sharedAt: 'desc' },
    take: 50,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://vitalcv.com';

  return shares.map((s) => ({
    shareId: s.id,
    organizationId: s.organizationId,
    organizationName: s.organizationName,
    purposeOfUse: s.purposeOfUse,
    sharedAt: s.sharedAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    webhookStatus: s.webhookStatus,
    emailFallbackSent: s.emailFallbackSent,
    revoked: s.revokedAt !== null,
    revokedAt: s.revokedAt?.toISOString() ?? null,
    bundleUrl: `${appUrl}/apply/${s.bundleId}`,
  }));
}

// ── Core: revoke a share ──────────────────────────────────────────────────────

export interface RevokeResult {
  success: boolean;
  shareId: string;
  revokedAt: string;
}

// BundleShareEvent.id is a Postgres uuid column — querying it with a non-uuid
// string makes Prisma throw (a 500) instead of returning null.
const SHARE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function revokeShare(
  shareId: string,
  clerkUserId: string,
): Promise<RevokeResult> {
  if (!SHARE_ID_RE.test(shareId)) {
    throw new ShareValidationError('Share not found.');
  }

  const share = await prisma.bundleShareEvent.findUnique({ where: { id: shareId } });

  if (!share) {
    throw new ShareValidationError('Share not found.');
  }
  if (share.sharedByClerkUserId !== clerkUserId) {
    throw Object.assign(new Error('Not authorized to revoke this share.'), { statusCode: 403 });
  }
  if (share.revokedAt) {
    throw new ShareValidationError('Share is already revoked.');
  }

  const updated = await prisma.bundleShareEvent.update({
    where: { id: shareId },
    data: { revokedAt: new Date(), revokedByClerkUserId: clerkUserId },
  });

  appendAuditEvent({
    category: ['REVOCATION'],
    actor: clerkUserId,
    resource: shareId,
    requestFields: { shareId, bundleId: share.bundleId, organizationId: share.organizationId },
    resultFields: { revokedAt: updated.revokedAt?.toISOString() },
    severity: 'WARNING',
  });

  log('info', 'apply_share_revoked', {
    shareId,
    bundleId: share.bundleId,
    organizationId: share.organizationId,
    revokedByClerkUserId: clerkUserId,
  });

  return {
    success: true,
    shareId,
    revokedAt: updated.revokedAt!.toISOString(),
  };
}
