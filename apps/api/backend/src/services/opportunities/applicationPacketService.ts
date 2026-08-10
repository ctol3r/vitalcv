/**
 * applicationPacketService — Wave 0 (Seal the Application Evidence Contract).
 *
 * Pure construction, canonicalization, hashing, and replay verification of the
 * immutable ApplicationPacket. NO database access and NO clock reads in this
 * module: the transaction (Bundle 0.2) resolves current state and timestamps,
 * then this module freezes them. That separation is what makes a sealed packet
 * replayable without rereading mutable current state.
 *
 * The packet stores per-field VALUES with their evidence state, source, and
 * observation time — never only a readiness score or rendered summary.
 */

import { createHash } from 'node:crypto';

import type { CanonicalSourceCoverageState } from '@vitalcv/trust-state';

import type { ClinicianTrustState } from '../trust/trustStateEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Evidence vocabulary shared with the web glyph system — no bare "verified". */
export type PacketEvidenceState =
  | 'source_backed'
  | 'checked'
  | 'self_attested'
  | 'needs_review'
  | 'access_required'
  | 'unavailable'
  | 'employer_decided'
  /**
   * The clinician had this evidence and chose not to disclose it.
   *
   * A withheld field stays PRESENT in the packet with a null value; it is
   * never dropped. Omitting it would make "I chose not to share this" and
   * "no such evidence exists" indistinguishable to the reviewer — opposite
   * facts. A packet whose shape hides that difference misleads by
   * construction, which is the one thing a disclosure artifact must not do.
   */
  | 'withheld';

export interface PacketFieldEntry {
  /** Disclosure section this field belongs to (e.g. "identity"). */
  sectionId: string;
  /** Stable field identifier (e.g. "identity.npi"). */
  fieldId: string;
  /** Human label as presented to the clinician at consent time. */
  label: string;
  /** The exact value presented. Null = disclosed-as-absent, never omitted. */
  value: string | null;
  evidenceState: PacketEvidenceState;
  /** Source identifier (e.g. "nppes", "oig_leie", "self_attested"). */
  sourceId: string;
  /** When the source last observed this value (ISO), null if never. */
  sourceObservedAt: string | null;
  /** Freshness horizon (ISO) after which the entry must present as stale. */
  freshUntil: string | null;
  /** Ingested artifact backing the value, when one exists. */
  artifactId: string | null;
  /** Verification receipt backing the value, when one exists. */
  receiptId: string | null;
}

/**
 * The evidence states an ABSENCE may carry — a strict subset of
 * `PacketEvidenceState`, not a second vocabulary.
 *
 * Every affirmative state is excluded by construction: an absence can never be
 * `source_backed` or `checked` (nothing was found, so nothing was affirmed),
 * never `self_attested` or `employer_decided` (nobody asserted anything), and
 * never `withheld` (a withheld field STAYS in `fields` with a null value — see
 * `PacketEvidenceState.withheld` — so a withheld section is not an absent one).
 * What remains is the honest range for "we do not have this".
 */
export const PACKET_ABSENCE_STATES = [
  /** Nothing was obtained: no source read, no usable record, or stale/preview data. */
  'unavailable',
  /** The route to this evidence is gated behind access the platform does not have. */
  'access_required',
  /**
   * A human must look. Either the source answered and returned no record for
   * this clinician (a FINDING, not missing evidence), or the resolved trust
   * state claims something for this section that never reached the packet.
   */
  'needs_review',
] as const;

export type PacketAbsenceState = (typeof PACKET_ABSENCE_STATES)[number];

/**
 * Compile-time proof that the absence vocabulary IS the evidence vocabulary.
 * If someone adds an absence state that `PacketEvidenceState` does not define,
 * this assignment stops compiling — the two lists cannot drift into two
 * different words for the same fact.
 */
const _absenceStatesAreEvidenceStates: readonly PacketEvidenceState[] = PACKET_ABSENCE_STATES;
void _absenceStatesAreEvidenceStates;

/**
 * A section the clinician selected that contributed ZERO fields.
 *
 * `selectedSections` alone cannot carry this. A packet naming "licensure" in
 * `selectedSections` with no licensure field present reads, to an employer, as
 * "licensure was checked and came back clean" — when the truth is that nothing
 * was found. Absence of evidence rendered as evidence of absence is the exact
 * defect class this record exists to close: the packet now SAYS "licensure —
 * nothing found, and here is why" instead of leaving a silence the reader fills
 * in favourably.
 *
 * Sealed, never derived at read time. Computed after the fact, an absence would
 * be recomputed against whatever the sources say today, so two readers of the
 * same immutable packet could see different absences — which is the one thing a
 * sealed artifact must not permit.
 */
export interface PacketSectionAbsence {
  /** The selected section that produced no field entry. */
  sectionId: string;
  /** Why nothing was found — same vocabulary as a present field's state. */
  evidenceState: PacketAbsenceState;
  /**
   * A standalone sentence the employer reads instead of silence. It must state
   * that nothing was found; it must never read as a clean result.
   */
  reason: string;
}

/**
 * What the clinician chose to disclose — the ONE input preview and sealing
 * both consume.
 *
 * Disclosure used to be section-level only (`selectedSections: string[]`), and
 * preview and seal each took that list as a bare positional argument. Two call
 * sites reading two separately-passed arguments is how a preview and a sealed
 * packet drift apart: the clinician approves one thing and discloses another,
 * with no type error and nothing to notice. One object, passed to both, makes
 * that drift a compile error instead of a disclosure incident.
 *
 * The decision is recorded per FIELD in the sealed `fields` array (see
 * `PacketEvidenceState.withheld`), which the seal hash already covers — so
 * what was withheld is as immutable as what was shared, recoverable via
 * `withheldFieldIdsOf`, and never a second list that can disagree.
 */
export interface DisclosureSelection {
  /** Sections the clinician opted into. */
  sections: readonly string[];
  /**
   * Field ids inside those sections the clinician withheld. The fields still
   * appear in the packet, valueless and marked `withheld` — see
   * `PacketEvidenceState`.
   */
  withheldFieldIds?: readonly string[];
}

/**
 * Accepts the shared object or a bare section list.
 *
 * The positional-array form is the legacy shape and stays supported so
 * previously sealed packets keep verifying — a packet sealed with no
 * `disclosureSelection` must hash exactly as it did when written.
 */
export function normalizeDisclosureSelection(
  selection: DisclosureSelection | readonly string[],
): { sections: string[]; withheldFieldIds: string[] } {
  if (Array.isArray(selection)) {
    return { sections: [...(selection as readonly string[])].sort(), withheldFieldIds: [] };
  }
  const value = selection as DisclosureSelection;
  return {
    sections: [...value.sections].sort(),
    // Sorted + de-duplicated: this is hashed, so two equivalent selections
    // must produce one canonical form.
    withheldFieldIds: [...new Set(value.withheldFieldIds ?? [])].sort(),
  };
}

/**
 * Which fields a sealed packet withheld — derived from the packet itself.
 *
 * Deliberately NOT a stored parallel list. `fields` already encodes the
 * decision per entry (`evidenceState: 'withheld'`) and is already covered by
 * the seal hash; a second hashed list of the same fact would be one more thing
 * that can disagree with it, and the disagreement would be unresolvable after
 * sealing. One source of truth, derived on read.
 */
export function withheldFieldIdsOf(
  content: Pick<ApplicationPacketContent, 'fields'>,
): string[] {
  return content.fields
    .filter((field) => field.evidenceState === 'withheld')
    .map((field) => field.fieldId)
    .sort();
}

export interface ApplicationPacketContent {
  applicationId: string;
  packetVersion: number;
  clerkUserId: string;
  clinicianNpi: string;
  opportunityId: string;
  employerOrgId: string;
  purpose: string;
  recipient: string;
  selectedSections: string[];
  fields: PacketFieldEntry[];
  /**
   * Explicit per-section absences — one entry for every selected section that
   * produced no field. Inside the seal, so they replay unchanged like every
   * other packet element.
   *
   * Three states, and they are NOT interchangeable:
   *   - `undefined` — a legacy packet sealed before absences were recorded. The
   *     key is omitted from the canonical bytes so the original hash still
   *     verifies. This says nothing about whether sections were empty.
   *   - `[]` — a positive statement: every selected section contributed
   *     evidence. New packets ALWAYS set this rather than omitting it, because
   *     an omitted key would make "nothing was absent" indistinguishable from
   *     "absence was never computed" — the same silence defect one layer up.
   *   - non-empty — the sections that produced nothing, and why.
   */
  sectionAbsences?: PacketSectionAbsence[];
  clinicianNote: string | null;
  methodologyVersion: string;
  consentAt: string;
  consentReceiptId: string;
  /**
   * First-class grant binding. Omitted for legacy packets so their canonical
   * bytes and stored hashes remain exactly unchanged.
   */
  consentGrantId?: string;
  /**
   * The opportunity version the application was sealed against (its updatedAt at
   * seal time) — "what the clinician applied to". OPTIONAL, and covered by the
   * hash when present. Legacy packets sealed before this field existed omit it
   * entirely (undefined, which `canonicalize` drops), so their stored hash is
   * unchanged and still verifies. New packets always set it, so it is always
   * hashed for them. Never store `null` here for a new packet — an omitted key
   * and a `null` key hash differently.
   */
  opportunityVersion?: string;
}

export interface SealedApplicationPacket extends ApplicationPacketContent {
  packetHash: string;
}

// ── Canonicalization + hash ───────────────────────────────────────────────────

/**
 * Deterministic serialization: recursively key-sorted objects, arrays kept in
 * order, no undefined. Two semantically identical packets ALWAYS produce the
 * same bytes, so the hash is stable across process restarts and key-order
 * differences.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item ?? null)).join(',')}]`;
  }
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) throw new Error('Packet content must be finite numbers.');
      return JSON.stringify(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'object': {
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort();
      return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
    }
    default:
      throw new Error(`Packet content cannot contain ${typeof value}.`);
  }
}

export function hashPacketContent(content: ApplicationPacketContent): string {
  return createHash('sha256').update(canonicalize(content), 'utf8').digest('hex');
}

/**
 * Every selected section must be ACCOUNTED FOR — by a field or by an absence.
 *
 * This is the invariant that makes the absence record a guarantee rather than a
 * convention. Without it, a caller that forgets to pass `sectionAbsences` seals
 * a packet whose `selectedSections` names a section the reader will infer was
 * checked and clean — the original defect, reintroduced silently. Here it is a
 * thrown error at seal time instead.
 *
 * Legacy packets are unaffected: replay verification hashes stored content
 * directly and never calls `sealPacket`.
 */
function assertSectionsAreAccountedFor(content: ApplicationPacketContent): void {
  const withFields = new Set(content.fields.map((field) => field.sectionId));
  const absent = new Map(
    (content.sectionAbsences ?? []).map((absence) => [absence.sectionId, absence]),
  );

  const silent = content.selectedSections.filter(
    (sectionId) => !withFields.has(sectionId) && !absent.has(sectionId),
  );
  if (silent.length > 0) {
    throw new Error(
      `Cannot seal a packet with unexplained sections: ${silent.join(', ')}. `
      + 'A selected section with no field must carry an explicit absence — '
      + 'silence reads to an employer as a clean check.',
    );
  }

  for (const [sectionId] of absent) {
    if (withFields.has(sectionId)) {
      throw new Error(
        `Section ${sectionId} is recorded as absent but contributed fields.`,
      );
    }
    if (!content.selectedSections.includes(sectionId)) {
      throw new Error(
        `Section ${sectionId} is recorded as absent but was never selected.`,
      );
    }
  }
}

/** Seal = content + its hash. The hash covers EVERYTHING in the content. */
export function sealPacket(content: ApplicationPacketContent): SealedApplicationPacket {
  if (content.fields.length === 0) {
    throw new Error('A disclosure packet must contain at least one field entry.');
  }
  if (!content.consentReceiptId || !content.consentAt) {
    throw new Error('A disclosure packet cannot seal without recorded consent.');
  }
  assertSectionsAreAccountedFor(content);
  return { ...content, packetHash: hashPacketContent(content) };
}

/**
 * Replay verification: given a stored packet row, confirm the content still
 * hashes to the recorded seal. This is the acceptance-gate check — the exact
 * submitted packet must replay after Wallet evidence changes.
 */
export function verifySealedPacket(stored: SealedApplicationPacket): boolean {
  const { packetHash, ...content } = stored;
  return hashPacketContent(content as ApplicationPacketContent) === packetHash;
}

// ── Trust-state → field entries ───────────────────────────────────────────────

const FACT_SECTION_BY_TYPE: Record<string, string> = {
  identity: 'identity',
  npi: 'identity',
  exclusion: 'exclusions',
  oig_leie: 'exclusions',
  licensure: 'licensure',
  license: 'licensure',
  enrollment: 'enrollment',
  pecos: 'enrollment',
};

function factStatusToEvidenceState(status: string): PacketEvidenceState {
  const normalized = status.toLowerCase();
  if (normalized.includes('self')) return 'self_attested';
  if (normalized.includes('review') || normalized.includes('conflict')) return 'needs_review';
  if (normalized.includes('gated') || normalized.includes('access')) return 'access_required';
  if (normalized.includes('unavailable') || normalized.includes('unknown') || normalized.includes('mock')) {
    return 'unavailable';
  }
  if (normalized.includes('source') || normalized.includes('active') || normalized.includes('confirmed')) {
    return 'source_backed';
  }
  if (normalized.includes('clear') || normalized.includes('checked') || normalized.includes('verified')) {
    return 'checked';
  }
  return 'needs_review';
}

/**
 * Map the resolved trust state's canonical facts into packet field entries,
 * honoring the clinician's section-level disclosure selection. Facts outside
 * the selected sections are OMITTED — an employer requirement cannot silently
 * force unrelated disclosure.
 */
export function buildFieldEntriesFromTrustState(
  trustState: Pick<ClinicianTrustState, 'facts' | 'npi'>,
  selection: DisclosureSelection | readonly string[],
): PacketFieldEntry[] {
  const { sections, withheldFieldIds } = normalizeDisclosureSelection(selection);
  const selected = new Set(sections);
  const withheld = new Set(withheldFieldIds);
  const entries: PacketFieldEntry[] = [];

  for (const fact of trustState.facts) {
    const sectionId =
      FACT_SECTION_BY_TYPE[fact.factType.toLowerCase()] ?? fact.factType.toLowerCase();
    if (!selected.has(sectionId)) continue;

    const fieldId = `${sectionId}.${fact.factType.toLowerCase()}.${fact.source.toLowerCase()}`;
    // Field-level disclosure. The field stays in the packet either way — only
    // its value and evidence state change — so the reviewer can always tell a
    // withheld field from one that never existed.
    const isWithheld = withheld.has(fieldId);

    entries.push({
      sectionId,
      fieldId,
      label: fact.factType,
      value: isWithheld ? null : fact.details ?? null,
      evidenceState: isWithheld ? 'withheld' : factStatusToEvidenceState(fact.status),
      sourceId: fact.source.toLowerCase(),
      // Provenance is suppressed with the value. Leaving the observation time
      // and freshness horizon on a withheld field would leak the shape of the
      // evidence the clinician declined to share.
      sourceObservedAt: isWithheld ? null : fact.verifiedAt ?? null,
      freshUntil: isWithheld ? null : fact.expiresAt ?? null,
      artifactId: null,
      receiptId: null,
    });
  }

  // Deterministic order — packet hashing must not depend on fact iteration order.
  entries.sort((a, b) => a.fieldId.localeCompare(b.fieldId));
  return entries;
}

// ── Trust-state → section absences ────────────────────────────────────────────

/**
 * The trust-state signals an absence is derived from. Every one of these is
 * DIMENSION-KEYED, so attributing a signal to a section involves no guessing.
 */
export type AbsenceTrustSignals = Partial<
  Pick<
    ClinicianTrustState,
    'identityVerified' | 'exclusionStatus' | 'licensureStatus' | 'pecosStatus' | 'sourceCoverage'
  >
>;

/**
 * Coverage entries are attributed to a section by source id, because
 * `ClinicianTrustState.sourceCoverage` is flattened across dimensions and no
 * longer carries the dimension it came from.
 *
 * Deliberately partial. The licensure source id is dynamic (it can be any
 * authority the credential names — Nursys, FSMB, a state board variant), so
 * this table cannot be exhaustive. An unmapped source is simply not attributed:
 * the absence keeps the conservative default and its reason makes no claim
 * about source coverage at all. That direction UNDERSTATES what the platform
 * knows, which is the safe way to be wrong here — the opposite direction would
 * put a source's words against a section they did not describe.
 */
const SECTION_BY_COVERAGE_SOURCE: Readonly<Record<string, string>> = {
  NPPES_API: 'identity',
  NPPES_BULK: 'identity',
  OIG_LEIE: 'exclusions',
  SAM_GOV: 'exclusions',
  PECOS_PUBLIC: 'enrollment',
  STATE_BOARD: 'licensure',
  STATE_BOARD_CA: 'licensure',
  STATE_BOARD_NY: 'licensure',
  STATE_BOARD_TX: 'licensure',
  NURSYS_QUICKCONFIRM: 'licensure',
  NURSYS_ENOTIFY: 'licensure',
};

const ABSENCE_STATE_BY_COVERAGE_STATE: Readonly<
  Record<CanonicalSourceCoverageState, PacketAbsenceState>
> = {
  // The source answered affirmatively, yet nothing reached the packet. That
  // contradiction is for a human, not for silent omission.
  checked: 'needs_review',
  // The source was read and returned no record for this clinician. A settled
  // answer is a FINDING; rendering it as "unavailable" would understate it.
  notFound: 'needs_review',
  reviewRequired: 'needs_review',
  accessRequired: 'access_required',
  gated: 'access_required',
  unavailable: 'unavailable',
  pending: 'unavailable',
  stale: 'unavailable',
  notDecisionGrade: 'unavailable',
  previewOnly: 'unavailable',
};

/**
 * Does the resolved trust state assert anything about this section? Used only
 * to detect the contradiction case — a claim that never became a packet field.
 */
function trustStateClaimsSection(sectionId: string, signals: AbsenceTrustSignals): boolean {
  switch (sectionId) {
    case 'identity':
      return signals.identityVerified === true;
    case 'exclusions':
      return signals.exclusionStatus === 'CLEAR'
        || signals.exclusionStatus === 'EXCLUDED'
        || signals.exclusionStatus === 'POSSIBLE_MATCH';
    case 'licensure':
      return signals.licensureStatus === 'verified' || signals.licensureStatus === 'expired';
    case 'enrollment':
      return signals.pecosStatus === 'ENROLLED'
        || signals.pecosStatus === 'NOT_FOUND'
        || signals.pecosStatus === 'OPTED_OUT';
    default:
      return false;
  }
}

/**
 * How each section is NAMED to the person reading the reason.
 *
 * An absence reason is customer-facing copy — it renders verbatim on the
 * employer and clinician surfaces — so it is bound by EC-9's language rules,
 * which ban the internal nouns this module otherwise uses freely. A raw
 * `sectionId` is also just an identifier: "exclusions" is not what a reviewer
 * calls the thing. Unknown sections fall back to the id, which is honest — a
 * made-up friendly name for a section we do not recognise would be worse.
 */
const SECTION_READING_LABEL: Readonly<Record<string, string>> = {
  identity: 'identity',
  licensure: 'licensure',
  enrollment: 'Medicare enrollment',
  exclusions: 'federal exclusion screening',
};

function readingLabel(sectionId: string): string {
  return SECTION_READING_LABEL[sectionId] ?? sectionId;
}

/** Appends the source's OWN words, attributed, without letting them stand alone. */
function withSourceNote(lead: string, note?: string | null): string {
  const trimmed = note?.trim().replace(/[.\s]+$/, '');
  return trimmed ? `${lead} Source note: ${trimmed}.` : lead;
}

function absenceFor(
  sectionId: string,
  signals: AbsenceTrustSignals,
  coverage: { state: CanonicalSourceCoverageState; reason: string } | undefined,
): PacketSectionAbsence {
  const label = readingLabel(sectionId);

  if (trustStateClaimsSection(sectionId, signals)) {
    return {
      sectionId,
      evidenceState: 'needs_review',
      reason: withSourceNote(
        `Nothing was found for ${label}. The current profile reports a ${label} result that was `
        + 'not included here, so the two disagree — unresolved, not a clean check.',
        coverage?.reason,
      ),
    };
  }

  if (coverage) {
    const evidenceState = ABSENCE_STATE_BY_COVERAGE_STATE[coverage.state];
    const lead = coverage.state === 'notFound'
      ? `Nothing was found for ${label}. The source was read and returned no record for this `
        + 'clinician — an answer, not a pending check.'
      : evidenceState === 'access_required'
        ? `Nothing was found for ${label}. Reaching this evidence needs source access VitalCV does `
          + 'not hold, so it was never read.'
        : `Nothing was found for ${label}. No usable record came back from its source.`;
    return { sectionId, evidenceState, reason: withSourceNote(lead, coverage.reason) };
  }

  return {
    sectionId,
    evidenceState: 'unavailable',
    // Says only what is unconditionally true. In particular it makes NO claim
    // about which sources ran — an unmapped coverage entry may well exist.
    reason: `Nothing was found for ${label}. No evidence for it was included, and this is not a `
      + 'check that came back clean.',
  };
}

/**
 * Build the explicit absence record for a disclosure.
 *
 * Called with the SAME selection and the SAME field list the packet seals, so
 * the absences describe exactly the packet they are sealed into.
 */
export function buildSectionAbsencesFromTrustState(
  trustState: AbsenceTrustSignals,
  selection: DisclosureSelection | readonly string[],
  fields: readonly PacketFieldEntry[],
): PacketSectionAbsence[] {
  const { sections } = normalizeDisclosureSelection(selection);
  const sectionsWithFields = new Set(fields.map((field) => field.sectionId));

  const coverageBySection = new Map<string, { state: CanonicalSourceCoverageState; reason: string }>();
  for (const entry of trustState.sourceCoverage ?? []) {
    const sectionId = SECTION_BY_COVERAGE_SOURCE[entry.sourceId];
    if (sectionId && !coverageBySection.has(sectionId)) {
      coverageBySection.set(sectionId, { state: entry.state, reason: entry.reason });
    }
  }

  return sections
    .filter((sectionId) => !sectionsWithFields.has(sectionId))
    .map((sectionId) => absenceFor(sectionId, trustState, coverageBySection.get(sectionId)))
    // Deterministic order — this is hashed.
    .sort((left, right) => left.sectionId.localeCompare(right.sectionId));
}
