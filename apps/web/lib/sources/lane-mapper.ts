/**
 * Lane-state mapper (LIVE-102 builder slice).
 *
 * Single source of truth for how the five lane states emitted by
 * /api/ingest/[npi] become visible UI tokens. The contract is:
 *
 *   pending       != unavailable
 *   unavailable   != access_required
 *   access_required != source_backed
 *   source_backed != stale
 *
 * The UI MUST use these distinct tones / labels — flattening any two
 * into a single pill is the lane-fidelity regression LIVE-102 is
 * specifically guarding against.
 *
 * Cadence is surfaced separately so the consumer never mistakes a
 * monthly / quarterly snapshot for a real-time feed.
 *
 * NPPES-specific honesty: when a lane's source is `NPPES`, the
 * mapper emits an explicit "identity only — does not confirm
 * licensure validity" disclaimer alongside the label. This is
 * enforced regardless of state, so a `source_backed` NPPES row
 * can never be misread as licensure proof.
 */

export type LaneState =
  | 'source_backed'
  | 'pending'
  | 'unavailable'
  | 'access_required'
  | 'stale';

export type LaneCadence = 'live' | 'monthly' | 'quarterly' | 'lane_dependent';

export type LaneSource = 'NPPES' | 'OIG_LEIE' | 'PECOS_PUBLIC' | 'STATE_BOARD';

export type LaneTone = 'success' | 'info' | 'warning' | 'gated' | 'neutral';

export interface LaneViewModel {
  source: LaneSource;
  state: LaneState;
  cadence: LaneCadence;
  /** Short label shown on the chip / pill. */
  label: string;
  /** UI tone for the chip; must be distinct per state. */
  tone: LaneTone;
  /** Long-form detail surfaced under the chip. */
  detail: string;
  /** Cadence note — "Updated monthly", "Public release: quarterly", etc. */
  cadenceNote: string;
  /**
   * Lane-specific honest disclaimer. NPPES always carries an
   * "identity only" disclaimer; OIG/LEIE always says "Federal scope,
   * not real-time"; PECOS always says "Public posture, not real-time"
   * regardless of state. State board always says "Institutional
   * access required, not a clinician defect".
   */
  disclaimer: string;
  /** ISO timestamp the lane evidence was read, when available. */
  readAt?: string;
  /** Public-source URL for receipt-style attribution, when available. */
  sourceUrl?: string;
  /** Identity projection (NPPES only today). */
  identity?: {
    displayName: string;
    enumerationType: 'NPI-1' | 'NPI-2' | 'unknown';
    taxonomy: string | null;
    enumerationDate: string | null;
    lastUpdated: string | null;
    nppesStatus: 'A' | 'I' | 'unknown';
    practiceState: string | null;
  };
}

export interface RawLane {
  source: LaneSource;
  state: LaneState;
  cadence: LaneCadence;
  detail?: string;
  readAt?: string;
  sourceUrl?: string;
  identity?: LaneViewModel['identity'];
}

const SOURCE_LABEL: Record<LaneSource, string> = {
  NPPES: 'Identity (NPPES)',
  OIG_LEIE: 'Federal exclusion (OIG LEIE)',
  PECOS_PUBLIC: 'Medicare enrollment (PECOS public)',
  STATE_BOARD: 'State licensure',
};

const STATE_LABEL: Record<LaneState, string> = {
  source_backed: 'Source-backed',
  pending: 'Pending',
  unavailable: 'Unavailable',
  access_required: 'Access required',
  stale: 'Stale',
};

const STATE_TONE: Record<LaneState, LaneTone> = {
  // Five distinct tones — never collapse two states into one tone.
  source_backed: 'success',
  pending: 'info',
  unavailable: 'warning',
  access_required: 'gated',
  stale: 'neutral',
};

const CADENCE_NOTE: Record<LaneCadence, string> = {
  live: 'Public registry — read on demand.',
  monthly: 'Federal release — refreshed monthly.',
  quarterly: 'Public release — refreshed quarterly.',
  lane_dependent: 'Cadence depends on the configured state-board lane.',
};

const SOURCE_DISCLAIMER: Record<LaneSource, string> = {
  NPPES:
    'NPPES confirms identity only — it does not confirm licensure validity.',
  OIG_LEIE:
    'Federal exclusion scope only. Not a real-time OIG feed; reflects the latest available source release.',
  PECOS_PUBLIC:
    'Public Medicare FFS enrollment posture. Not the real-time PECOS portal.',
  STATE_BOARD:
    'State board access depends on institutional agreements (Nursys / FSMB / state portal). It is not a clinician defect.',
};

/**
 * Map a raw lane object (from /api/ingest/[npi]) to a UI view model.
 * Falls back to safe defaults if `state` or `cadence` arrive in an
 * unexpected shape — no UI ever crashes on a malformed lane.
 */
export function toLaneViewModel(raw: RawLane): LaneViewModel {
  const state: LaneState = STATE_LABEL[raw.state] ? raw.state : 'unavailable';
  const cadence: LaneCadence = CADENCE_NOTE[raw.cadence] ? raw.cadence : 'lane_dependent';
  const sourceTitle = SOURCE_LABEL[raw.source] ?? raw.source;
  const stateLabel = STATE_LABEL[state];
  return {
    source: raw.source,
    state,
    cadence,
    label: `${sourceTitle} — ${stateLabel}`,
    tone: STATE_TONE[state],
    detail:
      raw.detail?.trim() ||
      defaultDetail(raw.source, state),
    cadenceNote: CADENCE_NOTE[cadence],
    disclaimer: SOURCE_DISCLAIMER[raw.source],
    readAt: raw.readAt,
    sourceUrl: raw.sourceUrl,
    identity: raw.identity,
  };
}

export function toLaneViewModels(raws: readonly RawLane[]): LaneViewModel[] {
  return raws.map(toLaneViewModel);
}

function defaultDetail(source: LaneSource, state: LaneState): string {
  switch (state) {
    case 'source_backed':
      return `${SOURCE_LABEL[source]} returned a current source-backed response.`;
    case 'pending':
      return `${SOURCE_LABEL[source]} check is in progress.`;
    case 'unavailable':
      return `${SOURCE_LABEL[source]} did not return a response. Source unavailability is not a clinician defect.`;
    case 'access_required':
      return `${SOURCE_LABEL[source]} requires institutional access. Not a clinician defect.`;
    case 'stale':
      return `${SOURCE_LABEL[source]} returned a snapshot older than the freshness window.`;
  }
}
