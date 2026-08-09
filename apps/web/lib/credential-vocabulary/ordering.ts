/**
 * Per-profession ordering profiles + the deterministic post-nominal renderer.
 *
 * Ordering is NOT universal — it is a per-profession convention:
 * - Nursing: ANCC's published display standard — highest degree → licensure →
 *   state designations → national certifications → honors. The rationale is
 *   PERMANENCE (degrees cannot be taken away; certifications are voluntary),
 *   which is why the order is encoded, not just asserted.
 * - Physical therapy: APTA convention puts the LICENSE first ("PT, DPT, OCS").
 * - Physicians: clinical doctorate → other degrees → fellowship honorifics;
 *   board certifications and licenses are by convention NEVER rendered as
 *   suffixes (they are structured profile fields instead).
 *
 * Fail-closed: unknown credential ids never render — they are returned in
 * `unknownIds` for the curation queue, the same posture as the PSV chain.
 */

import { CREDENTIAL_DEFS } from './definitions';
import type {
  CredentialDef,
  HeldCredential,
  OrderingProfile,
  OrderingProfileId,
  RenderedPostNominals,
} from './types';

export const ORDERING_PROFILES: readonly OrderingProfile[] = [
  {
    id: 'nursing',
    authority: 'ANCC display standard (nursingworld.org, "How to Display Your Credentials")',
    order: ['degree', 'license', 'state_designation', 'national_certification', 'fellowship_honor'],
  },
  {
    id: 'physician',
    authority: 'AMA / specialty-college convention — degrees then fellowship honorifics; licenses and board certifications are never suffixes',
    order: ['degree', 'fellowship_honor'],
  },
  {
    id: 'physician_associate',
    authority: 'NCCPA / AAPA convention — PA-C leads, then degrees, CAQ tags, honors',
    order: ['national_certification', 'degree', 'fellowship_honor'],
  },
  {
    id: 'physical_therapy',
    authority: 'APTA convention — license first: "PT, DPT, OCS"',
    order: ['license', 'degree', 'national_certification', 'fellowship_honor'],
  },
  {
    id: 'default',
    authority: 'ANCC-style generic (safest cross-profession default)',
    order: ['degree', 'license', 'state_designation', 'national_certification', 'fellowship_honor'],
  },
];

const defById = new Map(CREDENTIAL_DEFS.map((d) => [d.id, d]));
const profileById = new Map(ORDERING_PROFILES.map((p) => [p.id, p]));

export function getCredentialDef(id: string): CredentialDef | undefined {
  return defById.get(id);
}

/** Tokens held by more than one issuer — ambiguity is structural, not an error. */
export function ambiguousTokens(): Map<string, CredentialDef[]> {
  const byToken = new Map<string, CredentialDef[]>();
  for (const def of CREDENTIAL_DEFS) {
    const list = byToken.get(def.token) ?? [];
    list.push(def);
    byToken.set(def.token, list);
  }
  return new Map([...byToken].filter(([, defs]) => defs.length > 1));
}

/**
 * Render a suffix line from structured credentials. Deterministic:
 * 1. Resolve ids (unknown → unknownIds, fail-closed).
 * 2. Drop legacy rows and opt-outs (→ excludedIds).
 * 3. Dedup degrees: only the highest-ranked degree per field renders
 *    (DNP beats MSN beats BSN within nursing; MD + MPH both stay — different
 *    fields). ANCC: list only the highest degree per field.
 * 4. Order kinds per the profession's profile; within a kind, higher rank
 *    first, then stable input order. Kinds absent from the profile do not
 *    render (physician licenses, for example).
 */
export function renderPostNominals(
  held: readonly HeldCredential[],
  profileId: OrderingProfileId = 'default',
): RenderedPostNominals {
  const profile = profileById.get(profileId) ?? profileById.get('default')!;
  const unknownIds: string[] = [];
  const excludedIds: string[] = [];

  const resolved: { def: CredentialDef; inputIndex: number }[] = [];
  held.forEach((h, inputIndex) => {
    const def = defById.get(h.credentialDefId);
    if (!def) {
      unknownIds.push(h.credentialDefId);
      return;
    }
    if (h.showInSuffix === false || def.status !== 'active') {
      excludedIds.push(def.id);
      return;
    }
    resolved.push({ def, inputIndex });
  });

  // Degree dedup per field: keep the highest rank; ties keep first input.
  const bestDegreeByField = new Map<string, { def: CredentialDef; inputIndex: number }>();
  for (const entry of resolved) {
    if (entry.def.kind !== 'degree') continue;
    const field = entry.def.field ?? entry.def.id;
    const current = bestDegreeByField.get(field);
    if (!current || (entry.def.rank ?? 0) > (current.def.rank ?? 0)) {
      if (current) excludedIds.push(current.def.id);
      bestDegreeByField.set(field, entry);
    } else {
      excludedIds.push(entry.def.id);
    }
  }

  const kept = resolved.filter(
    (e) => e.def.kind !== 'degree' || bestDegreeByField.get(e.def.field ?? e.def.id) === e,
  );

  const tokens: string[] = [];
  for (const kind of profile.order) {
    const ofKind = kept
      .filter((e) => e.def.kind === kind)
      .sort((a, b) => (b.def.rank ?? 0) - (a.def.rank ?? 0) || a.inputIndex - b.inputIndex);
    for (const e of ofKind) tokens.push(e.def.token);
  }
  for (const e of kept) {
    if (!profile.order.includes(e.def.kind)) excludedIds.push(e.def.id);
  }

  return { rendered: tokens.join(', '), tokens, unknownIds, excludedIds };
}
