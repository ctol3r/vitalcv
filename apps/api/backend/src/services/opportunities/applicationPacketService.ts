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
  | 'employer_decided';

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
  clinicianNote: string | null;
  methodologyVersion: string;
  consentAt: string;
  consentReceiptId: string;
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

/** Seal = content + its hash. The hash covers EVERYTHING in the content. */
export function sealPacket(content: ApplicationPacketContent): SealedApplicationPacket {
  if (content.fields.length === 0) {
    throw new Error('A disclosure packet must contain at least one field entry.');
  }
  if (!content.consentReceiptId || !content.consentAt) {
    throw new Error('A disclosure packet cannot seal without recorded consent.');
  }
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
  selectedSections: readonly string[],
): PacketFieldEntry[] {
  const selected = new Set(selectedSections);
  const entries: PacketFieldEntry[] = [];

  for (const fact of trustState.facts) {
    const sectionId =
      FACT_SECTION_BY_TYPE[fact.factType.toLowerCase()] ?? fact.factType.toLowerCase();
    if (!selected.has(sectionId)) continue;
    entries.push({
      sectionId,
      fieldId: `${sectionId}.${fact.factType.toLowerCase()}.${fact.source.toLowerCase()}`,
      label: fact.factType,
      value: fact.details ?? null,
      evidenceState: factStatusToEvidenceState(fact.status),
      sourceId: fact.source.toLowerCase(),
      sourceObservedAt: fact.verifiedAt ?? null,
      freshUntil: fact.expiresAt ?? null,
      artifactId: null,
      receiptId: null,
    });
  }

  // Deterministic order — packet hashing must not depend on fact iteration order.
  entries.sort((a, b) => a.fieldId.localeCompare(b.fieldId));
  return entries;
}
