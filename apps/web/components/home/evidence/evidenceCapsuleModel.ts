/**
 * evidenceCapsuleModel — what the homepage lookup is allowed to say.
 *
 * A PURE transform from the two real payloads (`/api/identity/bootstrap/{npi}`
 * and `/api/trust-state/{npi}`) to rows a component may render. No fetching, no
 * storage, no clock.
 *
 * WHY IT IS A MODULE. The rules below are truth-contract rules, and they were
 * previously expressed as ten inline conditionals inside a JSX tree — which is
 * how the grouping bug shipped: an OIG result whose own detail said "monthly
 * snapshot" was rendered under a heading that said "Confirmed today". A
 * heading that outranks its own rows is not a styling mistake, it is a claim.
 *
 * THE RULES, in one place:
 *
 *   1. Cadence is READ FROM `SOURCE_LANE_OPS`, never typed here. That registry
 *      is the single definition of what each lane is and how fresh it can be.
 *   2. No group heading may claim more than its weakest member. `returned`
 *      means "a named source answered", NOT "confirmed today" — the OIG lane
 *      answers from a monthly file, so a same-day exclusion cannot be in it.
 *   3. Nothing is manufactured: no observation time, no verifiedAt, no
 *      confidence, no percentage, no readiness score, no clinician identity
 *      that did not come from the registry.
 *   4. An absent source result is `unavailable`, never an implied pass.
 *   5. `access_required` and `unavailable` rows stay VISIBLE. Hiding a lane the
 *      platform cannot read is how a partial answer starts looking complete.
 *
 * OBSERVATION TIME IS DELIBERATELY ABSENT. `TrustState` declares no timestamp
 * field, and `/api/trust-state/{npi}` is a pass-through proxy, so the frontend
 * has no guaranteed observation time for any lane. Rather than invent one — or
 * imply freshness by omission — every row carries its lane's CADENCE, and the
 * capsule states that it shows no per-check timestamp. `observedAt` exists in
 * the type and is populated only from real data; today nothing populates it.
 */

import type { ProvenanceState } from '@/design-system/components/ProvenanceChip';
import type { TrustState } from '@/components/readiness/sourceCheckNarration';
import { SOURCE_LANE_OPS } from '@/lib/trust/sourceLanes';

export interface Bootstrap {
  firstName?: string;
  lastName?: string;
  specialty?: string;
  state?: string;
  npiType?: string;
  alreadyRegistered?: boolean;
  /** Provenance label on the identity fields — 'NPPES_API' when registry-derived. */
  identitySource?: string;
}

/** Which group a row belongs to. The group's LABEL may not out-claim its rows. */
export type EvidenceRowKind = 'returned' | 'attention' | 'unavailable';

export interface EvidenceRow {
  id: string;
  /** What the row is about. */
  claim: string;
  /** The source that answered, or null when none did. */
  source: string | null;
  /** Exactly what came back, in plain words. Never a verdict. */
  returned: string;
  /** The lane's own refresh cadence, from the registry. */
  cadence: string | null;
  /** The honest limit of this row, or null when there is nothing to qualify. */
  limitation: string | null;
  /** Only ever set from real response data. Nothing populates it today. */
  observedAt: string | null;
  kind: EvidenceRowKind;
  /**
   * The row's own state, in the canonical provenance vocabulary.
   *
   * Set EXPLICITLY at each construction site below, never derived in a view.
   * A renderer that inferred "this came back from a monthly file, so call it
   * checked" would be making a truth claim in a presentation layer — which is
   * how the group-heading bug this module was written to kill got in. The
   * place that knows what a source actually said is the place that says it.
   */
  state: ProvenanceState;
}

export interface EvidenceCapsuleModel {
  npi: string;
  identity: { name: string | null; detail: string | null; fromRegistry: boolean };
  rows: EvidenceRow[];
  /** One next-best action, or null. */
  nextAction: string | null;
  /** True when no lane returned anything at all. */
  empty: boolean;
}

const laneOf = (laneId: string) => SOURCE_LANE_OPS.find((l) => l.laneId === laneId);
const cadenceOf = (laneId: string) => laneOf(laneId)?.cadenceLabel ?? null;
const nameOf = (laneId: string) => laneOf(laneId)?.marketingShortName ?? null;

/**
 * Group labels. `returned` is deliberately NOT "Confirmed today".
 *
 * HHS publishes the LEIE monthly, so an exclusion added yesterday cannot be in
 * the file this lane reads. "Confirmed today" over a monthly snapshot is the
 * exact over-claim `sourceLanes.ts` was written to stop ("copy must render
 * cadence, never a blanket 'live'"), and it is the one place where the gap is a
 * liability for an employer acting on the panel. "Returned by source" says
 * precisely what happened and nothing more.
 */
export const GROUP_LABEL: Record<EvidenceRowKind, string> = {
  returned: 'Returned by source',
  attention: 'Needs your attention',
  unavailable: 'Unavailable without additional access',
};

/**
 * The card's identity header is registry-framed ("located in NPPES"), so it may
 * carry only registry-derived values — never a registered account's self-entered
 * display name (truth contract: no registry framing around self-attested values).
 *
 * The backend labels provenance via `identitySource`. A payload WITHOUT that
 * label is the legacy shape, which echoed the account's own profile fields for
 * an already-registered NPI — that one combination must fall back to the
 * neutral header instead of presenting an account name as the registry record
 * (how a seeded "Sarah Chen" profile rendered as the NPPES identity of a real
 * provider's NPI in production).
 */
/**
 * Present an NPPES-returned name the way a person writes it.
 *
 * NPPES stores names in upper case ("JACOB AARON"), which is a storage
 * convention, not the provider's name. Rendering it raw shouts at the
 * clinician on the one surface meant to feel like recognition.
 *
 * This is presentation normalization of a registry value, NOT a truth
 * change: the same characters, cased. It lives here, exported, because two
 * surfaces render this same field from this same source — the evidence
 * capsule's identity header and `buildCareerProfile`'s `displayName` — and
 * they disagreed until they shared this function. A second copy is how they
 * drift apart again.
 *
 * Known limit, deliberately kept: internal capitals are not reconstructed,
 * so "MCDONALD" reads "Mcdonald" and "O'BRIEN" reads "O'brien". Guessing
 * where a capital belongs inside a surname invents information about a real
 * person; the correction path ("Not you?") and the claim flow are where a
 * clinician fixes their own name.
 */
export function registryDisplayName(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

export function registryIdentity(
  boot: Bootstrap | null,
): { name: string | null; detail: string | null; fromRegistry: boolean } {
  const fromRegistry = boot
    ? boot.identitySource
      ? boot.identitySource === 'NPPES_API'
      : !boot.alreadyRegistered
    : false;
  if (!boot || !fromRegistry) return { name: null, detail: null, fromRegistry: false };

  const raw = [boot.firstName, boot.lastName].filter(Boolean).join(' ').trim();
  return {
    name: registryDisplayName(raw),
    detail: [boot.specialty, boot.state].filter(Boolean).join(' · ') || null,
    fromRegistry: true,
  };
}

export function buildEvidenceCapsule(
  npi: string,
  boot: Bootstrap | null,
  trust: TrustState | null,
): EvidenceCapsuleModel {
  const rows: EvidenceRow[] = [];

  // ── Identity ──
  if (trust?.identityVerified) {
    rows.push({
      id: 'identity',
      claim: 'Identity',
      source: nameOf('nppes_identity'),
      returned: 'Located in the NPPES registry',
      cadence: cadenceOf('nppes_identity'),
      limitation: 'The registry lists the provider record. It does not attest to current practice.',
      observedAt: null,
      kind: 'returned',
      state: 'checked',
    });
  }

  // ── OIG / LEIE exclusions ──
  if (trust?.exclusionStatus === 'CLEAR') {
    rows.push({
      id: 'oig',
      claim: 'OIG exclusions',
      source: nameOf('oig_exclusions'),
      returned: 'No match in the current LEIE file',
      cadence: cadenceOf('oig_exclusions'),
      limitation: 'A monthly file cannot show an exclusion published after it was compiled.',
      observedAt: null,
      kind: 'returned',
      state: 'checked',
    });
  } else if (trust?.exclusionStatus === 'EXCLUDED') {
    rows.push({
      id: 'oig',
      claim: 'OIG exclusions',
      source: nameOf('oig_exclusions'),
      returned: 'A match was returned in the current LEIE file',
      cadence: cadenceOf('oig_exclusions'),
      limitation: 'Identity matching is by name and NPI. Confirm against the source record.',
      observedAt: null,
      kind: 'attention',
      state: 'reviewRequired',
    });
  } else if (trust?.exclusionStatus === 'UNCHECKED') {
    rows.push({
      id: 'oig',
      claim: 'OIG exclusions',
      source: nameOf('oig_exclusions'),
      returned: 'Check not yet run',
      cadence: cadenceOf('oig_exclusions'),
      limitation: null,
      observedAt: null,
      kind: 'unavailable',
      state: 'pending',
    });
  }

  // ── CMS PECOS enrollment ──
  if (trust?.pecosStatus === 'ENROLLED') {
    rows.push({
      id: 'pecos',
      claim: 'Medicare enrollment (PECOS)',
      source: nameOf('pecos_enrollment'),
      returned: 'An active enrollment was returned',
      cadence: cadenceOf('pecos_enrollment'),
      limitation: 'A quarterly snapshot can lag a recent enrollment change.',
      observedAt: null,
      kind: 'returned',
      state: 'checked',
    });
  } else if (trust?.pecosStatus === 'NOT_FOUND') {
    rows.push({
      id: 'pecos',
      claim: 'Medicare enrollment (PECOS)',
      source: nameOf('pecos_enrollment'),
      returned: 'No active enrollment found',
      cadence: cadenceOf('pecos_enrollment'),
      limitation: 'A quarterly snapshot can lag a recent enrollment change.',
      observedAt: null,
      kind: 'attention',
      state: 'notFound',
    });
  }

  // ── Blockers the engine raised. PECOS already has its own row above. ──
  for (const [index, blocker] of (trust?.blockers ?? []).entries()) {
    if (/pecos/i.test(blocker)) continue;
    rows.push({
      id: `blocker-${index}`,
      claim: 'Needs review',
      source: null,
      returned: blocker,
      cadence: null,
      limitation: null,
      observedAt: null,
      kind: 'attention',
      state: 'reviewRequired',
    });
  }

  // ── State licensure ──
  // Absent or unknown is ACCESS, not a pass and not a failure. The lane is
  // `planned` in the registry with cadence `access-gated`; saying anything
  // stronger would invent a board read that never happened.
  if (!trust?.licensureStatus || trust.licensureStatus === 'unknown') {
    rows.push({
      id: 'licensure',
      claim: 'State licensure',
      source: nameOf('state_license'),
      returned: 'Not read — state-board access required',
      cadence: cadenceOf('state_license'),
      limitation: 'VitalCV has no board or FSMB access for this lane yet.',
      observedAt: null,
      kind: 'unavailable',
      state: 'accessRequired',
    });
  }

  const nextAction = trust?.nextActions?.[0] ?? null;

  return {
    npi,
    identity: registryIdentity(boot),
    rows,
    nextAction,
    empty: rows.length === 0,
  };
}

/** Rows of one kind, in the order they were derived. */
export function rowsOfKind(model: EvidenceCapsuleModel, kind: EvidenceRowKind): EvidenceRow[] {
  return model.rows.filter((row) => row.kind === kind);
}

/**
 * The provenance line for a row: SOURCE · CADENCE · LIMITATION, with absent
 * parts dropped rather than filled in. An observation time is appended only if
 * one was actually provided.
 */
export function provenanceParts(row: EvidenceRow): string[] {
  return [row.source, row.cadence, row.observedAt, row.limitation].filter(
    (part): part is string => Boolean(part),
  );
}
