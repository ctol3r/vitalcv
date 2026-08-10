/**
 * ClinicianCareerProfile — the ONE profile model of the one-real-loop preview.
 *
 * Derived from the production NPI contracts, never restated: the identity
 * fields come from `NpiBootstrapResult` (the /api/identity/bootstrap/[npi]
 * projection of NPPES) and the readiness summary is COUNTED from the same
 * pure transform the production homepage renders — buildEvidenceCapsule —
 * so this model cannot disagree with what the evidence capsule would say.
 *
 * Every scene (hero, MATCHA, Apply, employer handoff, continuity) receives
 * THIS object. No scene may hard-code a clinician name, specialty, monogram,
 * or NPI.
 *
 * Truth boundaries inherited from the stack (do not "fix" them here):
 * - identitySource 'UNAVAILABLE' collapses no-result, registry outage, and
 *   rate-limiting — the upstream service flattens all three to one state at
 *   HTTP 200. We say "the registry could not answer"; we never guess which.
 * - Missing fields stay missing. NPPES's credential field is dropped by the
 *   bootstrap projection, so `credential` is only present when a future
 *   contract carries it — it is never inferred from the name.
 */

import {
  buildEvidenceCapsule,
  registryDisplayName,
  rowsOfKind,
  type Bootstrap,
  type EvidenceCapsuleModel,
} from '@/components/home/evidence/evidenceCapsuleModel';
import type { TrustState } from '@/components/readiness/sourceCheckNarration';

export interface ClinicianCareerProfile {
  npi: string;
  /** "First Last" from NPPES; never invented. */
  displayName: string;
  /** Uppercase initials for the identity mark, derived from displayName. */
  monogram: string;
  credential?: string;
  specialty?: string;
  /** Practice state from NPPES, when present. */
  location?: string;
  /** 'NPPES_API' when the registry answered; 'UNAVAILABLE' otherwise. */
  identitySource: string;
  readinessSummary: {
    answered: number;
    total: number;
    needsReview: number;
  };
}

/** The registry answered and named a person. */
export function isResolvedIndividual(b: Bootstrap): boolean {
  return b.identitySource === 'NPPES_API'
    && b.npiType !== 'TYPE_2'
    && Boolean(b.firstName || b.lastName);
}

/** TYPE_2 — an organization NPI, which cannot become a clinician profile. */
export function isOrganization(b: Bootstrap): boolean {
  return b.identitySource === 'NPPES_API' && b.npiType === 'TYPE_2';
}

function monogramOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase() || '·';
}

/**
 * Build the profile from the two real responses. Returns null unless the
 * registry actually named an individual — the caller renders the honest
 * organization / unavailable states instead.
 */
export function buildCareerProfile(
  npi: string,
  boot: Bootstrap,
  trust: TrustState | null,
): ClinicianCareerProfile | null {
  if (!isResolvedIndividual(boot)) return null;

  // Cased by the SAME transform the capsule's identity header uses, so the
  // two renderings of this one registry field cannot disagree again.
  const displayName = registryDisplayName([boot.firstName, boot.lastName].filter(Boolean).join(' ')) ?? '';
  const capsule: EvidenceCapsuleModel = buildEvidenceCapsule(npi, boot, trust);
  const answered = rowsOfKind(capsule, 'returned').length;
  /* "Needs review" = attention rows plus lanes no source could answer —
   * the same two groups the capsule presents after its returned group. */
  const needsReview = rowsOfKind(capsule, 'attention').length
    + rowsOfKind(capsule, 'unavailable').length;

  return {
    npi,
    displayName,
    monogram: monogramOf(displayName),
    specialty: boot.specialty || undefined,
    location: boot.state || undefined,
    identitySource: boot.identitySource ?? 'UNAVAILABLE',
    readinessSummary: {
      answered,
      total: capsule.rows.length,
      needsReview,
    },
  };
}
