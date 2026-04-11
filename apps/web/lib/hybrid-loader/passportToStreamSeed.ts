/**
 * passportToStreamSeed.ts — SSR → client hydration bridge.
 *
 * Part of the Hybrid Loader (see docs/superpowers/specs/2026-04-10-hybrid-loader-design.md).
 *
 * Pure function that maps a server-fetched PassportData into an
 * IngestStreamState so the client hook (useIngestStream, via
 * useHybridProviderData) can use it as its initial state.
 *
 * Call sites:
 *   - apps/web/app/review/[entityId]/ReviewPageClient.tsx (server component):
 *       passes `passportToStreamSeed(passport)` to <ReviewClient hybridSeed=.../>.
 *
 * Why pure: it's called on the server, serialized across the RSC boundary,
 * and re-read on the client. Any React or storage access would break that.
 */

import type { PassportData } from '@/lib/trust/passport-contract';
import {
  createInitialIngestStreamState,
  type IngestStreamState,
} from '@/hooks/ingestStreamState';

const UNKNOWN_IDENTITY_STATUSES = new Set(['UNKNOWN', 'MISSING', 'PREVIEW']);

/**
 * Convert a PassportData snapshot into an IngestStreamState seed.
 *
 * Preconditions:
 *   - `passport` is a full, server-validated payload.
 *
 * Postconditions:
 *   - Returns an IngestStreamState with `phase: 'done'` and `isUsable: true`
 *     (iff identity is authoritative).
 *   - Never throws. Falls back to an empty initial state if the passport
 *     lacks the minimum identity surface.
 */
export function passportToStreamSeed(passport: PassportData): IngestStreamState {
  const base = createInitialIngestStreamState();

  // Defensive reads: ReviewPageClient runs this immediately after an external
  // backend fetch, and contract tests (plus the real NPPES proxy path) can
  // return passport shells that lack identity/standing/readiness entirely. The
  // function's documented contract is "never throw; fall back to an empty seed"
  // so we treat any missing field as its most conservative default.
  const identity = (passport?.identity ?? {}) as Partial<PassportData['identity']>;
  const standing = (passport?.standing ?? {}) as Partial<PassportData['standing']>;
  const readiness = (passport?.readiness ?? {}) as Partial<PassportData['readiness']>;

  const displayName = typeof identity.displayName === 'string' ? identity.displayName : '';
  const statusString = typeof identity.status === 'string' ? identity.status : '';

  const identityAuthoritative =
    Boolean(displayName)
    && !UNKNOWN_IDENTITY_STATUSES.has(statusString.toUpperCase());

  const exclusionStatus = standing.exclusionStatus;
  const exclusionChecked =
    typeof exclusionStatus === 'string' && exclusionStatus !== 'UNCHECKED';

  const pecosEnrollmentStatus = standing.pecosEnrollmentStatus;
  const enrollmentChecked =
    typeof pecosEnrollmentStatus === 'string'
    && pecosEnrollmentStatus !== 'UNCHECKED'
    && pecosEnrollmentStatus !== 'UNKNOWN';

  const readyAt = new Date().toISOString();

  return {
    ...base,
    phase: 'done',
    npi: passport?.npi ?? identity.npi,
    anchorEntityId: identityAuthoritative ? passport?.entityId : undefined,
    isUsable: identityAuthoritative,
    readyAt: identityAuthoritative ? readyAt : undefined,
    identity: {
      entityId: passport?.entityId,
      displayName: identity.displayName,
      specialty: identity.specialty,
      entityType: identity.entityType,
      status: identity.status,
      authoritative: identityAuthoritative,
    },
    standing: {
      exclusionChecked,
      exclusionClear: standing.exclusionClear,
      exclusionStatus: standing.exclusionStatus,
      enrollmentChecked,
      enrollmentStatus: enrollmentChecked ? pecosEnrollmentStatus : undefined,
    },
    readiness: {
      score: readiness.score,
      level: readiness.level,
      status: readiness.status,
    },
    sources: {
      nppes: displayName ? 'done' : 'pending',
      oig: exclusionChecked ? 'done' : 'pending',
      pecos: enrollmentChecked ? 'done' : 'pending',
    },
  };
}
