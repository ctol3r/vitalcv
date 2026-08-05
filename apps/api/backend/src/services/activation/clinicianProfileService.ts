/**
 * Clinician activation — the durable profile service (Wave 1076 B1).
 *
 * Owns the transition from "a registry answered for an NPI" to "this clinician
 * has a reusable profile they reviewed and control". Deliberately does NOT own
 * ownership verification: that is a separate question with a separate state,
 * and every function here refuses to infer one from the other.
 *
 * Idempotency is the theme. A clinician on a flaky connection will retry a
 * save; a double-clicked button will send two. Neither may produce two
 * activation events, two drafts, or a re-stamped activation timestamp.
 */

import type { Prisma } from '@prisma/client';

import prisma from '../../graphql/prisma_client';
import { HttpError } from '../../utils/httpError';
import { log } from '../../obs/logger';
import {
  activationState,
  permissions,
  shouldEmitActivation,
  stateDisclosure,
  type ActivationState,
} from './clinicianProfileState';
import {
  mergeProfile,
  missingRequired,
  PROFILE_FIELDS,
  validateCorrections,
  type ResolvedField,
} from './clinicianProfileFields';
import { bootstrapFromNpi } from '../workspace/workspaceService';
import { resolveInternalUserId } from '../../middleware/verifiedActor';
import { writeActivationAudit, type ActivationAuditAction } from './clinicianProfileAudit';

const NPI_RE = /^\d{10}$/;

/**
 * The transaction client every mutation runs on.
 *
 * Typed structurally rather than as Prisma.TransactionClient so the tests can
 * supply a double without reconstructing Prisma's full surface.
 */
type Tx = {
  clinicianProfileDraft: {
    findUnique: (args: unknown) => Promise<unknown>;
    upsert: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
  };
  auditEvent: { create: (args: unknown) => Promise<unknown> };
};

const tx = <T>(fn: (t: Tx) => Promise<T>): Promise<T> =>
  (prisma as unknown as { $transaction: (f: (t: Tx) => Promise<T>) => Promise<T> }).$transaction(fn);

interface DraftRow {
  id: string;
  userId: string;
  npi: string;
  resolvedSnapshot: unknown;
  sourceObservations: unknown;
  resolvedAt: Date | null;
  clinicianFields: unknown;
  reviewedAt: Date | null;
  sharingConfirmedAt: Date | null;
  savedAt: Date | null;
  activatedAt: Date | null;
}

export interface ProfileView {
  npi: string;
  state: ActivationState;
  disclosure: string;
  fields: ResolvedField[];
  missingRequired: string[];
  reviewedAt: Date | null;
  sharingConfirmedAt: Date | null;
  savedAt: Date | null;
  activatedAt: Date | null;
  permissions: ReturnType<typeof permissions>;
  /** The field registry, so the surface never hardcodes its own copy. */
  fieldSpecs: typeof PROFILE_FIELDS;
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/*
 * Prisma's Json input type is narrower than Record<string, unknown> — it
 * refuses `undefined` anywhere in the tree. Everything written here has already
 * been through pickProfileFields (an allowlist that drops undefined), so the
 * cast asserts something the allowlist has made true rather than papering over
 * an unknown shape.
 */
const asJson = (v: Record<string, unknown>) => v as Prisma.InputJsonObject;

function assertNpi(npi: string): string {
  const digits = (npi ?? '').trim();
  if (!NPI_RE.test(digits)) throw new HttpError(400, 'NPI must be exactly 10 digits.');
  return digits;
}

/**
 * Is this NPI ownership-verified for this user?
 *
 * Read from `NpiOwnership`, never from the draft. A draft is a statement about
 * a profile; ownership is a statement about a person. Storing ownership on the
 * draft would let a save quietly imply it.
 */
export async function isOwnershipVerified(clerkUserId: string, npi: string): Promise<boolean> {
  // Same id boundary as requireNpiAuthorization: npi_ownership.user_id is the
  // INTERNAL User.id (a uuid), not the Clerk subject.
  const internalUserId = await resolveInternalUserId(clerkUserId);
  if (!internalUserId) return false;

  const row = await prisma.npiOwnership.findFirst({
    where: { userId: internalUserId, npi },
    select: { verifiedAt: true, verificationMethod: true, revokedAt: true },
    orderBy: { claimedAt: 'desc' },
  });
  if (!row || row.revokedAt || !row.verifiedAt) return false;
  const method = (row.verificationMethod ?? '').trim();
  return method === 'ADMIN_VERIFIED'
    || method === 'NPPES_IDENTITY_MATCH'
    || method === 'ISSUER_ATTESTED'
    || method === 'DELEGATED';
}

function toView(row: DraftRow, ownershipVerified: boolean): ProfileView {
  const fields = mergeProfile(
    obj(row.resolvedSnapshot),
    obj(row.clinicianFields),
    obj(row.sourceObservations) as Record<string, { source?: string; observedAt?: string }>,
  );
  const state = activationState(row, { ownershipVerified });
  return {
    npi: row.npi,
    state,
    disclosure: stateDisclosure(state),
    fields,
    missingRequired: missingRequired(fields),
    reviewedAt: row.reviewedAt,
    sharingConfirmedAt: row.sharingConfirmedAt,
    savedAt: row.savedAt,
    activatedAt: row.activatedAt,
    permissions: permissions(state),
    fieldSpecs: PROFILE_FIELDS,
  };
}

const SELECT = {
  id: true, userId: true, npi: true,
  resolvedSnapshot: true, sourceObservations: true, resolvedAt: true,
  clinicianFields: true,
  reviewedAt: true, sharingConfirmedAt: true, savedAt: true, activatedAt: true,
} as const;

/**
 * Create the draft, or recover the one that already exists.
 *
 * The public-source snapshot is resolved HERE, server-side, by the canonical
 * resolver — never taken from the request. An earlier version accepted the
 * browser's preview payload and stored it as `public_source`, which let any
 * caller manufacture provenance: edit the preview in devtools, claim, and your
 * own values would be labelled as a registry answer for the rest of the
 * profile's life. The client sends an NPI and nothing else.
 *
 * `upsert` on (userId, npi) makes the claim safe to repeat: a clinician who
 * signs in, gets interrupted and returns lands on their own draft rather than a
 * second one. A re-claim refreshes the snapshot and NEVER touches the
 * clinician's edits or the activation stamps.
 */
export async function createOrRecoverDraft(userId: string, npiRaw: string): Promise<ProfileView> {
  const npi = assertNpi(npiRaw);

  // The canonical path, reused — not a second NPPES implementation. This runs
  // BEFORE the transaction: only the database mutation and its receipt need to
  // be atomic, and holding a transaction open across a network fetch would pin
  // a connection for the length of an external call.
  const boot = await bootstrapFromNpi(npi);

  if (boot.npiType === 'TYPE_2') {
    throw new HttpError(
      400,
      'That NPI identifies an organization. A clinician profile needs an individual (Type 1) NPI.',
    );
  }

  /*
   * Provenance is stamped from what the SERVER observed. An earlier version
   * accepted the browser's preview payload and stored it as `public_source`,
   * which let any caller manufacture provenance.
   */
  const observedAt = new Date();
  const registryAnswered = boot.identitySource === 'NPPES_API';
  const snapshot: Record<string, unknown> = {};
  const observations: Record<string, unknown> = {};

  if (registryAnswered) {
    const name = [boot.firstName, boot.lastName].filter(Boolean).join(' ').trim();
    for (const [key, value] of [
      ['fullName', name || undefined],
      ['specialty', boot.specialty],
      ['practiceState', boot.state],
    ] as Array<[string, unknown]>) {
      if (value === undefined || value === null || value === '') continue;
      snapshot[key] = value;
      observations[key] = { source: 'NPPES', observedAt: observedAt.toISOString() };
    }
  }

  const row = await tx(async (t) => {
    const created = (await t.clinicianProfileDraft.upsert({
      where: { userId_npi: { userId, npi } },
      create: {
        userId, npi,
        resolvedSnapshot: asJson(snapshot),
        sourceObservations: asJson(observations),
        resolvedAt: registryAnswered ? observedAt : null,
      },
      // A re-claim refreshes the snapshot and NEVER touches edits or stamps.
      update: {
        resolvedSnapshot: asJson(snapshot),
        sourceObservations: asJson(observations),
        resolvedAt: registryAnswered ? observedAt : null,
      },
      select: SELECT,
    })) as unknown as DraftRow;

    await writeActivationAudit('CLINICIAN_PROFILE_CLAIMED', userId, created.id, {
      registryAnswered,
      observedFieldCount: Object.keys(snapshot).length,
    }, t);

    return created;
  });

  return toView(row, await isOwnershipVerified(userId, npi));
}

export async function readDraft(userId: string, npiRaw: string): Promise<ProfileView> {
  const npi = assertNpi(npiRaw);
  const row = (await prisma.clinicianProfileDraft.findUnique({
    where: { userId_npi: { userId, npi } },
    select: SELECT,
  })) as unknown as DraftRow | null;
  if (!row) throw new HttpError(404, 'No profile draft for that NPI.');
  return toView(row, await isOwnershipVerified(userId, npi));
}

/** Every reusable profile this clinician holds. */
export async function listProfiles(userId: string): Promise<ProfileView[]> {
  const rows = (await prisma.clinicianProfileDraft.findMany({
    where: { userId, savedAt: { not: null } },
    orderBy: { updatedAt: 'desc' },
    select: SELECT,
  })) as unknown as DraftRow[];
  return Promise.all(rows.map(async (r) => toView(r, await isOwnershipVerified(userId, r.npi))));
}

async function requireOwnDraft(userId: string, npi: string): Promise<DraftRow> {
  const row = (await prisma.clinicianProfileDraft.findUnique({
    where: { userId_npi: { userId, npi } },
    select: SELECT,
  })) as unknown as DraftRow | null;
  // 404 rather than 403: another user's draft is not the caller's to know about.
  if (!row) throw new HttpError(404, 'No profile draft for that NPI.');
  return row;
}

/**
 * One transactional mutation + its receipt, plus activation if this is the
 * moment it becomes true. Analytics is emitted only after the commit.
 */
async function mutateWithAudit(
  userId: string,
  npi: string,
  action: ActivationAuditAction,
  metadata: Parameters<typeof writeActivationAudit>[3],
  data: Record<string, unknown>,
): Promise<ProfileView> {
  const { row, activationCommitted } = await tx(async (t) => {
    const updated = (await t.clinicianProfileDraft.update({
      where: { userId_npi: { userId, npi } },
      data,
      select: SELECT,
    })) as unknown as DraftRow;

    await writeActivationAudit(action, userId, updated.id, metadata, t);

    return stampActivationInTx(t, userId, updated);
  });

  const view = toView(row, await isOwnershipVerified(userId, npi));
  // AFTER commit: a funnel event for an activation that rolled back is a lie
  // about something that did not happen.
  if (activationCommitted) emitActivationAnalytics(row, view.missingRequired.length);
  return view;
}

/**
 * Persist the clinician's corrections.
 *
 * Explicitly does NOT stamp `savedAt`. A correction is a draft write; a
 * reusable profile is a validated, complete thing the clinician asked to keep.
 * Conflated, any single keystroke satisfied the save condition activation
 * depends on, so a half-filled profile could activate.
 *
 * Writes ONLY to `clinicianFields`, so "what the registry said" and "what the
 * clinician says" both remain answerable after any number of corrections.
 */
export async function saveCorrections(
  userId: string,
  npiRaw: string,
  corrections: unknown,
): Promise<ProfileView> {
  const npi = assertNpi(npiRaw);
  const existing = await requireOwnDraft(userId, npi);
  // Throws on a declared field with an invalid value — silently discarding
  // something the clinician typed is worse than refusing it.
  const clean = validateCorrections(corrections);
  const merged = { ...obj(existing.clinicianFields), ...clean };

  return mutateWithAudit(userId, npi, 'CLINICIAN_PROFILE_CORRECTED', {
    correctedFieldCount: Object.keys(clean).length,
    correctedFieldKeys: Object.keys(clean).sort(),
  }, { clinicianFields: asJson(merged) });
}

/**
 * The explicit reusable-profile save — the only transition that stamps
 * `savedAt`. Refuses an incomplete profile: a clinician cannot keep something
 * that would reach an employer missing the fields that make it usable.
 *
 * Deliberately not called `activate`. The client asks to SAVE; activation is
 * what the server concludes when review and sharing control are also true.
 */
export async function saveReusableProfile(userId: string, npiRaw: string): Promise<ProfileView> {
  const npi = assertNpi(npiRaw);
  const existing = await requireOwnDraft(userId, npi);

  const missing = missingRequired(mergeProfile(
    obj(existing.resolvedSnapshot),
    obj(existing.clinicianFields),
    obj(existing.sourceObservations) as Record<string, { source?: string; observedAt?: string }>,
  ));
  if (missing.length > 0) {
    throw new HttpError(
      422,
      `Add ${missing.join(', ')} before saving a reusable profile.`,
      'PROFILE_INCOMPLETE',
    );
  }

  return mutateWithAudit(userId, npi, 'CLINICIAN_PROFILE_SAVED', { missingRequiredCount: 0 },
    // Idempotent: re-saving a complete profile keeps the first save time.
    { savedAt: existing.savedAt ?? new Date() });
}

export async function confirmReview(userId: string, npiRaw: string): Promise<ProfileView> {
  const npi = assertNpi(npiRaw);
  const existing = await requireOwnDraft(userId, npi);
  return mutateWithAudit(userId, npi, 'CLINICIAN_PROFILE_REVIEW_CONFIRMED', {},
    { reviewedAt: existing.reviewedAt ?? new Date() });
}

export async function confirmSharingControl(userId: string, npiRaw: string): Promise<ProfileView> {
  const npi = assertNpi(npiRaw);
  const existing = await requireOwnDraft(userId, npi);
  return mutateWithAudit(userId, npi, 'CLINICIAN_PROFILE_SHARING_CONFIRMED', {},
    { sharingConfirmedAt: existing.sharingConfirmedAt ?? new Date() });
}

/**
 * Stamp activation if — and only if — this is the moment it becomes true.
 *
 * Runs INSIDE the caller's transaction, so the initiating mutation, its audit,
 * the activation stamp and the activation audit are one unit: either all four
 * commit or none do.
 *
 * The write is conditioned on `activatedAt: null`, so two concurrent requests
 * cannot both stamp it — the second updates zero rows. That is the difference
 * between "we checked first" and "it cannot happen".
 *
 * Returns whether activation committed. Analytics is emitted by the caller
 * AFTER the transaction, because a funnel event for an activation that rolled
 * back is a lie about something that did not happen.
 */
async function stampActivationInTx(
  tx: Tx,
  userId: string,
  row: DraftRow,
): Promise<{ row: DraftRow; activationCommitted: boolean }> {
  if (!shouldEmitActivation(row)) return { row, activationCommitted: false };

  const stamped = await tx.clinicianProfileDraft.updateMany({
    where: { id: row.id, activatedAt: null },
    data: { activatedAt: new Date() },
  });
  if (stamped.count !== 1) return { row, activationCommitted: false };

  // The durable receipt, on the same transaction. Distinct responsibility from
  // the analytics event: that measures a funnel and may be sampled or dropped;
  // this records that a person's professional profile became active.
  await writeActivationAudit('CLINICIAN_PROFILE_ACTIVATED', userId, row.id, {
    correctedFieldCount: Object.keys(obj(row.clinicianFields)).length,
  }, tx);

  const fresh = (await tx.clinicianProfileDraft.findUnique({
    where: { id: row.id }, select: SELECT,
  })) as unknown as DraftRow;

  return { row: fresh, activationCommitted: true };
}

/**
 * Emit the funnel event, once the transaction has actually committed.
 *
 * No Clerk user id: the durable AuditEvent is the authoritative actor-linked
 * receipt, and a funnel stream does not need to name the person to count the
 * step. No NPI, name, credential value or correction text either.
 */
function emitActivationAnalytics(row: DraftRow, missingRequiredCount: number): void {
  log('info', 'clinician_profile_activated', {
    schemaVersion: 1,
    editedFieldCount: Object.keys(obj(row.clinicianFields)).length,
    requiredComplete: missingRequiredCount === 0,
  });
}
