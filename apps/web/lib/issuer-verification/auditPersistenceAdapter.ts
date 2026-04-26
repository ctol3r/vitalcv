import type {
  IssuerAuditEventRecord,
  IssuerAuditPersistenceMode,
  IssuerAuditWriteResult,
  IssuerAuditWriteStatus,
} from './auditPersistence';

/**
 * ISSUER-8 — Persistence adapter decision boundary.
 *
 * Truth contract:
 *   - Default adapter is `noop`. Active persistence is OFF unless
 *     explicitly turned on via configuration.
 *   - `repository_candidate` is NOT active persistence. It means a
 *     repository-shaped writer COULD be wired, but is not yet.
 *   - `repository_enabled` is the only kind that may yield a
 *     `persisted` write status — and even then, the actual write
 *     result must come from the writer (this module never claims
 *     persistence on the writer's behalf).
 *   - Missing config produces `unavailable` or `noop`, never
 *     `persisted`.
 *   - The adapter MUST preserve limitations, source basis, and
 *     responder attribution from the originating record. The
 *     adapter cannot upgrade `proofTier` or set
 *     `globalCredentialTruth: true`.
 *   - The adapter cannot claim an audit row was written when no
 *     writer was invoked.
 *
 * This module is a pure transform — no fetches, no DB writes, no
 * dynamic imports, no real I/O.
 */

/**
 * The kind of adapter selected for this environment. The
 * persistence boundary uses this to decide what statuses are
 * possible:
 *
 * - `noop` — reference no-op; never persists.
 * - `demo` — demo writer; never persists.
 * - `repository_candidate` — a repository-shaped writer is *available*
 *   in code but is not enabled for active writes.
 * - `repository_enabled` — a repository-shaped writer is enabled and
 *   is the only kind that may produce `persisted`.
 * - `unavailable` — config requested a writer that cannot be wired in
 *   this environment (missing dependency, missing env, etc.).
 */
export type IssuerAuditPersistenceAdapterKind =
  | 'noop'
  | 'demo'
  | 'repository_candidate'
  | 'repository_enabled'
  | 'unavailable';

export type IssuerPersistenceAdapterCapability =
  | 'write_audit_event'
  | 'write_psv_receipt'
  | 'replay_lifecycle'
  | 'hash_payload'
  | 'preserve_limitations'
  | 'preserve_source_basis'
  | 'preserve_responder_attribution';

/**
 * Static capability matrix per adapter kind. Capabilities listed
 * here describe what the adapter is *designed* to support — not
 * whether any particular write actually happened.
 *
 * Truth invariant: `noop` and `demo` never carry `write_audit_event`
 * or `write_psv_receipt` capabilities. `repository_candidate`
 * carries them in spirit (it would, if enabled) but is gated;
 * callers MUST treat the candidate's capabilities as advisory
 * until the kind transitions to `repository_enabled`.
 */
const CAPABILITIES_BY_KIND: Record<
  IssuerAuditPersistenceAdapterKind,
  ReadonlyArray<IssuerPersistenceAdapterCapability>
> = {
  noop: ['replay_lifecycle'],
  demo: ['replay_lifecycle'],
  repository_candidate: [
    'replay_lifecycle',
    'preserve_limitations',
    'preserve_source_basis',
    'preserve_responder_attribution',
  ],
  repository_enabled: [
    'write_audit_event',
    'write_psv_receipt',
    'replay_lifecycle',
    'preserve_limitations',
    'preserve_source_basis',
    'preserve_responder_attribution',
  ],
  unavailable: [],
};

/**
 * Caller-supplied configuration. The persistence adapter decision
 * is driven entirely by this input; there are no environment
 * lookups, no `process.env` reads, no implicit feature flags.
 *
 * - `mode === 'noop' | 'demo'` selects the corresponding adapter.
 * - `mode === 'repository'` selects either `repository_candidate`
 *   or `repository_enabled` depending on `enableRepositoryWrites`.
 * - `mode === 'none'` selects `unavailable`.
 */
export interface IssuerAuditPersistenceAdapterConfig {
  mode: 'none' | 'noop' | 'demo' | 'repository';
  /**
   * When `mode === 'repository'`, this flag must be set to `true`
   * for the adapter to transition from `repository_candidate` to
   * `repository_enabled`. Required because enabling real persistence
   * is an operator decision, not an inferred default.
   */
  enableRepositoryWrites?: boolean;
  /**
   * Optional human-readable description of the wiring (e.g.,
   * "Prisma-backed `chai-vc-platform-backend` repository at
   * apps/api/backend/repositories/psvReceipts.repo.ts"). Surfaced
   * verbatim by the review surface.
   */
  wiringDescription?: string;
  /**
   * Optional hint about why the adapter is unavailable, used when
   * `mode === 'repository'` but the writer cannot run in this
   * runtime (e.g., the repository module imports a server-only
   * dependency that cannot be loaded into the client bundle).
   */
  unavailableReason?: string;
}

/**
 * Decision payload produced by `chooseIssuerAuditPersistenceAdapter`.
 * Surfaces both the selected `kind` and a plain-language `reason`
 * the review surface can render verbatim.
 */
export interface IssuerPersistenceAdapterDecision {
  kind: IssuerAuditPersistenceAdapterKind;
  /** The persistence mode this adapter would feed back to the writer. */
  resultMode: IssuerAuditPersistenceMode;
  reason: string;
  capabilities: ReadonlyArray<IssuerPersistenceAdapterCapability>;
  /** Carried-through wiring description for the review surface. */
  wiringDescription?: string;
}

/**
 * Result of attempting to use an adapter — wraps a writer's
 * `IssuerAuditWriteResult` plus the decision metadata.
 */
export interface IssuerAuditPersistenceAdapterResult {
  decision: IssuerPersistenceAdapterDecision;
  /**
   * The persistence outcome reported by the underlying writer (or
   * synthesized by this module when no writer was invoked). Always
   * carries `persisted: false` unless the adapter is
   * `repository_enabled` AND a writer confirmed persistence.
   */
  writeResult: IssuerAuditWriteResult;
}

/**
 * The adapter interface itself. Adapters are pure: they accept a
 * record and return a synthesized write result. They do NOT call
 * the network, the database, or any external API directly.
 */
export interface IssuerAuditPersistenceAdapter {
  decision: IssuerPersistenceAdapterDecision;
  /**
   * Pure transform: returns the write result the adapter would feed
   * back if invoked under the current configuration. Adapters of
   * kind `noop`, `demo`, `repository_candidate`, and `unavailable`
   * MUST always return `persisted: false`.
   */
  attempt(record: IssuerAuditEventRecord): IssuerAuditWriteResult;
}

const DECISION_REASONS: Record<IssuerAuditPersistenceAdapterKind, string> = {
  noop: 'No-op adapter selected. Replay-only; nothing is persisted.',
  demo: 'Demo adapter selected. Replay-only; nothing is persisted.',
  repository_candidate:
    'Repository writer is in scope but not enabled. Persistence stays off until enableRepositoryWrites is set.',
  repository_enabled:
    'Repository writer is enabled. Actual persistence still requires the writer to confirm each row.',
  unavailable:
    'No adapter is wired in this environment. Persistence is unavailable.',
};

const DECISION_RESULT_MODE: Record<
  IssuerAuditPersistenceAdapterKind,
  IssuerAuditPersistenceMode
> = {
  noop: 'noop',
  demo: 'demo',
  repository_candidate: 'demo',
  repository_enabled: 'repository',
  unavailable: 'none',
};

const DECISION_WRITE_STATUS: Record<
  IssuerAuditPersistenceAdapterKind,
  IssuerAuditWriteStatus
> = {
  noop: 'demo_not_persisted',
  demo: 'demo_not_persisted',
  repository_candidate: 'demo_not_persisted',
  repository_enabled: 'pending_not_written',
  unavailable: 'unavailable',
};

/**
 * Pure: derive the adapter kind for a given config.
 */
function pickAdapterKind(
  config: IssuerAuditPersistenceAdapterConfig,
): IssuerAuditPersistenceAdapterKind {
  if (config.mode === 'none') return 'unavailable';
  if (config.mode === 'noop') return 'noop';
  if (config.mode === 'demo') return 'demo';
  if (config.mode === 'repository') {
    return config.enableRepositoryWrites === true
      ? 'repository_enabled'
      : 'repository_candidate';
  }
  return 'unavailable';
}

/**
 * Pure: build the decision payload for a given config. Default
 * config (no argument) returns the no-op decision.
 */
export function chooseIssuerAuditPersistenceAdapter(
  config: IssuerAuditPersistenceAdapterConfig = { mode: 'noop' },
): IssuerPersistenceAdapterDecision {
  const kind = pickAdapterKind(config);
  const baseReason = DECISION_REASONS[kind];
  const reason =
    kind === 'unavailable' && config.unavailableReason
      ? `${baseReason} ${config.unavailableReason}`
      : baseReason;
  return {
    kind,
    resultMode: DECISION_RESULT_MODE[kind],
    reason,
    capabilities: CAPABILITIES_BY_KIND[kind],
    wiringDescription: config.wiringDescription,
  };
}

/**
 * Pure: capability lookup helper. Equivalent to reading
 * `decision.capabilities`, surfaced separately so the review surface
 * can ask "does this kind have capability X?" without knowing the
 * full table.
 */
export function getIssuerPersistenceAdapterCapabilities(
  kind: IssuerAuditPersistenceAdapterKind,
): ReadonlyArray<IssuerPersistenceAdapterCapability> {
  return CAPABILITIES_BY_KIND[kind];
}

/**
 * Pure: defensive guard that throws when a caller tries to use a
 * repository adapter without confirming `enableRepositoryWrites`.
 * Use at the point where real persistence would be invoked.
 */
export function assertCanUseRepositoryAdapter(
  decision: IssuerPersistenceAdapterDecision,
): void {
  if (decision.kind !== 'repository_enabled') {
    throw new Error(
      `assertCanUseRepositoryAdapter refused: adapter kind is ${decision.kind}; only repository_enabled may perform real writes.`,
    );
  }
}

/**
 * Pure: convenience builder for a `repository_candidate` decision.
 * Useful when a caller wants to *describe* the repository wiring
 * without enabling it.
 */
export function buildRepositoryCandidateDecision(input: {
  wiringDescription: string;
}): IssuerPersistenceAdapterDecision {
  return chooseIssuerAuditPersistenceAdapter({
    mode: 'repository',
    enableRepositoryWrites: false,
    wiringDescription: input.wiringDescription,
  });
}

/**
 * Plain-language explanation of an adapter decision. Surfaced
 * verbatim by the review surface.
 */
export function explainPersistenceAdapterDecision(
  decision: IssuerPersistenceAdapterDecision,
): string {
  const wiring = decision.wiringDescription
    ? ` Wiring: ${decision.wiringDescription}.`
    : '';
  return `${decision.reason}${wiring}`;
}

/**
 * Build a no-op adapter from a decision. Always returns
 * `persisted: false` regardless of the record passed in. The result
 * status follows the static `DECISION_WRITE_STATUS` table.
 */
export function createPersistenceAdapter(
  decision: IssuerPersistenceAdapterDecision,
): IssuerAuditPersistenceAdapter {
  return {
    decision,
    attempt(_record: IssuerAuditEventRecord): IssuerAuditWriteResult {
      void _record;
      // Defense-in-depth: this module can never produce
      // `persisted: true` on its own. A real repository_enabled
      // adapter is provided by `repositoryAuditAdapter.ts` and even
      // there, persistence requires writer confirmation that does
      // not exist in this slice.
      return {
        status: DECISION_WRITE_STATUS[decision.kind],
        mode: decision.resultMode,
        persisted: false,
        message:
          decision.kind === 'unavailable'
            ? decision.reason
            : `${decision.reason} No row was persisted by this adapter.`,
      };
    },
  };
}
