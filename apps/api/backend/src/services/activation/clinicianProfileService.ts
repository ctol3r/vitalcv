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
  pickProfileFields,
  PROFILE_FIELDS,
  type ResolvedField,
} from './clinicianProfileFields';

const NPI_RE = /^\d{10}$/;

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
export async function isOwnershipVerified(userId: string, npi: string): Promise<boolean> {
  const row = await prisma.npiOwnership.findFirst({
    where: { userId, npi },
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
 * `upsert` on (userId, npi) is what makes the claim step safe to repeat: a
 * clinician who signs in, gets interrupted, and returns lands on their own
 * draft rather than a second one. A re-claim refreshes the public-source
 * snapshot but NEVER touches the clinician's edits or the activation stamps.
 */
export async function createOrRecoverDraft(
  userId: string,
  npiRaw: string,
  resolvedSnapshot: Record<string, unknown>,
  sourceObservations: Record<string, unknown> = {},
): Promise<ProfileView> {
  const npi = assertNpi(npiRaw);
  const snapshot = pickProfileFields(resolvedSnapshot);

  const row = (await prisma.clinicianProfileDraft.upsert({
    where: { userId_npi: { userId, npi } },
    create: {
      userId, npi,
      resolvedSnapshot: asJson(snapshot),
      sourceObservations: asJson(sourceObservations),
      resolvedAt: new Date(),
    },
    update: {
      resolvedSnapshot: asJson(snapshot),
      sourceObservations: asJson(sourceObservations),
      resolvedAt: new Date(),
    },
    select: SELECT,
  })) as unknown as DraftRow;

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
 * Save the clinician's corrections.
 *
 * Writes ONLY to `clinicianFields`. The public-source snapshot is never edited
 * in place, so "what the registry said" and "what the clinician says" both
 * remain answerable after any number of corrections.
 */
export async function saveCorrections(
  userId: string,
  npiRaw: string,
  corrections: unknown,
): Promise<ProfileView> {
  const npi = assertNpi(npiRaw);
  const existing = await requireOwnDraft(userId, npi);
  const merged = { ...obj(existing.clinicianFields), ...pickProfileFields(corrections) };

  const row = (await prisma.clinicianProfileDraft.update({
    where: { userId_npi: { userId, npi } },
    data: { clinicianFields: asJson(merged), savedAt: new Date() },
    select: SELECT,
  })) as unknown as DraftRow;

  return finalize(userId, row);
}

export async function confirmReview(userId: string, npiRaw: string): Promise<ProfileView> {
  const npi = assertNpi(npiRaw);
  const existing = await requireOwnDraft(userId, npi);
  const row = (await prisma.clinicianProfileDraft.update({
    where: { userId_npi: { userId, npi } },
    // Idempotent: re-confirming keeps the FIRST review time.
    data: { reviewedAt: existing.reviewedAt ?? new Date() },
    select: SELECT,
  })) as unknown as DraftRow;
  return finalize(userId, row);
}

export async function confirmSharingControl(userId: string, npiRaw: string): Promise<ProfileView> {
  const npi = assertNpi(npiRaw);
  const existing = await requireOwnDraft(userId, npi);
  const row = (await prisma.clinicianProfileDraft.update({
    where: { userId_npi: { userId, npi } },
    data: { sharingConfirmedAt: existing.sharingConfirmedAt ?? new Date() },
    select: SELECT,
  })) as unknown as DraftRow;
  return finalize(userId, row);
}

/**
 * Stamp activation if — and only if — this is the moment it becomes true.
 *
 * The write is conditioned on `activatedAt: null`, so two concurrent requests
 * cannot both stamp it: the second updates zero rows. That is the difference
 * between "we checked first" and "it cannot happen".
 */
async function finalize(userId: string, row: DraftRow): Promise<ProfileView> {
  if (shouldEmitActivation(row)) {
    const stamped = await prisma.clinicianProfileDraft.updateMany({
      where: { id: row.id, activatedAt: null },
      data: { activatedAt: new Date() },
    });

    if (stamped.count === 1) {
      /*
       * Stage metadata only. No NPI, name, credential value, correction text,
       * blocker detail or source-returned information — an activation log that
       * carries the profile recreates the disclosure it exists to measure.
       */
      log('info', 'clinician_profile_activated', {
        userId,
        editedFieldCount: Object.keys(obj(row.clinicianFields)).length,
      });
    }

    const fresh = (await prisma.clinicianProfileDraft.findUnique({
      where: { id: row.id }, select: SELECT,
    })) as unknown as DraftRow;
    return toView(fresh, await isOwnershipVerified(userId, row.npi));
  }
  return toView(row, await isOwnershipVerified(userId, row.npi));
}
