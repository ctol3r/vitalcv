/**
 * Clinician contact-consent ledger — the writer.
 *
 * Permission to contact a clinician is an explicit, recorded, revocable
 * event. It is deliberately NOT derived from `PersonProfile.verifiedEmail`:
 * that field is an OTP possession proof established to corroborate
 * NPI→person binding, and treating a possession proof as permission to send
 * mail is a purpose expansion the clinician never agreed to.
 *
 * ## Serialization
 *
 * Current state is the highest-`seq` event per (clinicianNpi, channel) — not
 * the newest `created_at` (millisecond ties are real) and not a uuid
 * tiebreak (arbitrary). A DB unique constraint on
 * (clinician_npi, channel, seq) serializes concurrent transitions: two
 * appends racing for the same seq cannot both land, so the loser rolls back
 * whole — audit row included — and retries against the new head.
 *
 * ## Atomicity and strictness
 *
 * Every write pairs an AuditEvent in the same transaction, audit-first. A
 * write that does not persist returns `persisted: false` and the route
 * answers 503. There is no degrade-to-ok path: a phantom grant would mean
 * mailing someone who never agreed.
 */
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';

/** Email is the only channel N1 can actually deliver on. */
export const CONTACT_CHANNELS = ['EMAIL'] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export type ContactConsentKind = 'granted' | 'revoked';

/** Contention retries. Each retry re-reads the head, so this converges fast. */
const MAX_APPEND_ATTEMPTS = 5;

export interface ContactConsentState {
  channel: ContactChannel;
  granted: boolean;
  eventRef: string;
  seq: number;
  at: string;
}

export interface ContactConsentWriteInput {
  clinicianNpi: string;
  channel: ContactChannel;
  /** How the grant was captured. Recorded, never inferred. */
  grantSource?: string;
}

export interface ContactConsentWriteResult {
  persisted: boolean;
  eventRef: string | null;
  changed: boolean;
  seq: number | null;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002';
}

async function appendTransition(
  kind: ContactConsentKind,
  input: ContactConsentWriteInput,
): Promise<ContactConsentWriteResult> {
  for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const head = await tx.clinicianContactConsentEvent.findFirst({
          where: { clinicianNpi: input.clinicianNpi, channel: input.channel },
          orderBy: { seq: 'desc' },
        });

        const currentlyGranted = head?.kind === 'granted';
        const wantGranted = kind === 'granted';
        if (currentlyGranted === wantGranted) {
          return {
            persisted: true,
            eventRef: head?.id ?? null,
            changed: false,
            seq: head?.seq ?? null,
          };
        }

        const id = randomUUID();
        const seq = (head?.seq ?? 0) + 1;
        const hash = createHash('sha256')
          .update(
            stableStringify({
              id,
              seq,
              clinicianNpi: input.clinicianNpi,
              channel: input.channel,
              kind,
              grantSource: input.grantSource ?? null,
            }),
          )
          .digest('hex');

        await tx.auditEvent.create({
          data: {
            id: randomUUID(),
            type:
              kind === 'granted'
                ? 'clinician.contact_consent_granted'
                : 'clinician.contact_consent_revoked',
            hash,
            referenceId: id,
            metadata: {
              channel: input.channel,
              seq,
              ...(input.grantSource ? { grantSource: input.grantSource } : {}),
            },
          },
        });

        await tx.clinicianContactConsentEvent.create({
          data: {
            id,
            clinicianNpi: input.clinicianNpi,
            channel: input.channel,
            kind,
            seq,
            eventHash: hash,
            grantSource: input.grantSource ?? null,
          },
        });

        return { persisted: true, eventRef: id, changed: true, seq };
      });
    } catch (error) {
      // Lost the race for this seq — the whole transaction rolled back.
      if (isUniqueViolation(error) && attempt < MAX_APPEND_ATTEMPTS - 1) continue;
      return { persisted: false, eventRef: null, changed: false, seq: null };
    }
  }
  return { persisted: false, eventRef: null, changed: false, seq: null };
}

/** Record permission to contact. Idempotent over an already-granted channel. */
export async function grantContactConsent(
  input: ContactConsentWriteInput,
): Promise<ContactConsentWriteResult> {
  return appendTransition('granted', input);
}

/** Withdraw permission. No-op when the channel is not currently granted. */
export async function revokeContactConsent(
  input: ContactConsentWriteInput,
): Promise<ContactConsentWriteResult> {
  return appendTransition('revoked', input);
}

/** Fold the ledger into current per-channel states for one clinician. */
export async function readContactConsentStates(
  clinicianNpi: string,
): Promise<ContactConsentState[]> {
  const events = await prisma.clinicianContactConsentEvent.findMany({
    where: { clinicianNpi },
    orderBy: { seq: 'asc' },
  });
  const heads = new Map<string, (typeof events)[number]>();
  for (const event of events) heads.set(event.channel, event);
  return [...heads.values()]
    .map((event) => ({
      channel: event.channel as ContactChannel,
      granted: event.kind === 'granted',
      eventRef: event.id,
      seq: event.seq,
      at: event.createdAt.toISOString(),
    }))
    .sort((a, b) => (a.channel < b.channel ? -1 : a.channel > b.channel ? 1 : 0));
}
