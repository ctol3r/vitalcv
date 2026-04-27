import type {
  IssuerAuditEventRecord,
  IssuerAuditWriteResult,
} from './auditPersistence';
import type { PSVReceipt } from './types';

/**
 * BACKEND-2 — Server-side PSV receipt writer + confirmation boundary.
 *
 * Truth contract:
 *   - This module defines the WRITER BOUNDARY. The default
 *     implementation is the "deferred" writer: it returns
 *     `status: 'deferred'` with `persisted: false` and never writes
 *     a row. Real persistence remains off until the schema-level
 *     blockers documented in
 *     docs/architecture/vitalcv-backend-persistence-defer-decision.md
 *     are closed.
 *   - A `persisted` status requires `ServerPsvReceiptWriterConfirmation`
 *     emitted by a real writer that talked to a real repository. The
 *     boundary helper REFUSES to fabricate a confirmation, refuses
 *     `persisted` from the deferred writer, and refuses any
 *     client-supplied `persisted` flag.
 *   - The writer NEVER sets `globalCredentialTruth=true`,
 *     `decisionGrade=true`, or any proof-tier upgrade. Those fields
 *     are not even part of `ServerPsvReceiptWriteInput`.
 *   - Limitations / source basis / responder attribution / freshness /
 *     scope MUST be preserved verbatim from input to result. A
 *     dropped field is a structural failure, not a silent rewrite.
 *
 * This module is a pure transform — no fetches, no DB writes, no
 * dynamic imports of backend modules, no real I/O. Adding these
 * types does NOT enable persistence.
 */

export type ServerPsvReceiptWriteStatus =
  | 'persisted'
  | 'failed'
  | 'unavailable'
  | 'dry_run'
  | 'deferred';

export type ServerPsvReceiptWriterFailureReason =
  | 'writer_unavailable'
  | 'writer_deferred_pending_schema_alignment'
  | 'missing_required_field'
  | 'client_supplied_persisted_flag'
  | 'forbidden_truth_tier_field'
  | 'invalid_writer_confirmation'
  | 'repository_write_failed';

/**
 * Confirmation a real writer emits AFTER a row is persisted. The
 * boundary helper accepts a confirmation only when its `writerMode`
 * is `'repository'` or `'external'` — `'demo'`, `'noop'`, etc. are
 * rejected.
 */
export interface ServerPsvReceiptWriterConfirmation {
  confirmedAt: string;
  confirmedBy: string;
  writerMode: 'repository' | 'external';
  /** Identifier the persistence layer assigned to the row. */
  persistedRowId: string;
  /** Optional cryptographic anchor / row hash. */
  anchor?: string;
}

/**
 * Caller-supplied input for a write attempt. The shape mirrors
 * `PSVReceipt` (ISSUER-4) — but the truth-contract literal fields
 * (`decisionGrade`, `proofTier`, `globalCredentialTruth`) are
 * INTENTIONALLY OMITTED. The boundary refuses any input that smuggles
 * them in.
 */
export interface ServerPsvReceiptWriteInput {
  /** Source of record — copied verbatim into the persisted row. */
  receipt: Pick<
    PSVReceipt,
    | 'psvReceiptId'
    | 'psvCandidateId'
    | 'receiptCandidateId'
    | 'requestId'
    | 'claimId'
    | 'claimType'
    | 'promotedAt'
    | 'promotedBy'
    | 'sourceBasis'
    | 'attributedResponder'
    | 'scope'
    | 'limitations'
    | 'freshness'
  >;
  /** Caller-controlled correlation ID for downstream audit correlation. */
  correlationId: string;
  /**
   * Optional audit-event record to be co-persisted alongside the
   * receipt. Same boundary rules apply.
   */
  auditEvent?: IssuerAuditEventRecord;
  /** Caller-controlled idempotency key. */
  idempotencyKey?: string;
  /**
   * If `true`, the writer attempts a dry run — validates input shape
   * and returns `status: 'dry_run'` without writing. Useful for
   * preview surfaces.
   */
  dryRun?: boolean;
}

/**
 * Result of a write attempt. `persisted` is the load-bearing flag.
 * Always inspect it explicitly; do not rely on `status` alone.
 */
export interface ServerPsvReceiptWriteResult {
  status: ServerPsvReceiptWriteStatus;
  /** True iff a real row was written AND the writer confirmed it. */
  persisted: boolean;
  /** Set on every refusal. */
  failureReason?: ServerPsvReceiptWriterFailureReason;
  /** Free-text explanation; surfaced verbatim by review surfaces. */
  message: string;
  /** Set ONLY when status === 'persisted'. */
  confirmation?: ServerPsvReceiptWriterConfirmation;
  /** The receipt input is preserved verbatim on every outcome. */
  preservedReceipt: ServerPsvReceiptWriteInput['receipt'];
}

export interface ServerPsvReceiptWriter {
  kind: 'deferred' | 'demo' | 'repository' | 'external';
  attempt(
    input: ServerPsvReceiptWriteInput,
  ): Promise<ServerPsvReceiptWriteResult>;
}

const DEFER_MESSAGE =
  'Server-side PSV receipt persistence is deferred pending schema ' +
  'alignment (see docs/architecture/vitalcv-backend-persistence-defer-decision.md). ' +
  'No row was written; the receipt is preserved for replay context only.';

const UNAVAILABLE_MESSAGE =
  'No server-side PSV receipt writer is wired in this environment. ' +
  'Persistence is unavailable.';

/**
 * Pure: predicate that returns the failure reason a write attempt
 * would surface, or `undefined` if input passes structural checks.
 * Does NOT call any writer.
 */
export function canUseServerPsvReceiptWriter(
  input: ServerPsvReceiptWriteInput,
): ServerPsvReceiptWriterFailureReason | undefined {
  // Structural check: input must carry the required ISSUER-4 fields.
  if (!input.receipt) return 'missing_required_field';
  if (!input.receipt.psvReceiptId) return 'missing_required_field';
  if (!input.receipt.scope) return 'missing_required_field';
  if (!input.receipt.limitations) return 'missing_required_field';
  if (!input.receipt.sourceBasis) return 'missing_required_field';
  if (!input.receipt.attributedResponder) return 'missing_required_field';
  if (!input.receipt.freshness) return 'missing_required_field';
  if (!input.correlationId) return 'missing_required_field';

  // Forbidden truth-tier fields. Even though the type omits them,
  // a JS caller can still pass them at runtime; refuse loudly.
  const receiptKeys = Object.keys(input.receipt as Record<string, unknown>);
  if (
    receiptKeys.includes('globalCredentialTruth') ||
    receiptKeys.includes('decisionGrade') ||
    receiptKeys.includes('proofTier')
  ) {
    return 'forbidden_truth_tier_field';
  }

  // Caller-supplied "persisted" intent. Even though the type omits
  // it, refuse defensively.
  const inputKeys = Object.keys(input as unknown as Record<string, unknown>);
  if (inputKeys.includes('persisted') || inputKeys.includes('confirmation')) {
    return 'client_supplied_persisted_flag';
  }

  return undefined;
}

interface BuildInputOptions {
  receipt: ServerPsvReceiptWriteInput['receipt'];
  correlationId: string;
  auditEvent?: IssuerAuditEventRecord;
  idempotencyKey?: string;
  dryRun?: boolean;
}

/**
 * Pure: build a well-formed write input. Strips any forbidden
 * truth-tier fields the caller may have included on the receipt.
 */
export function buildServerPsvReceiptWriteInput(
  options: BuildInputOptions,
): ServerPsvReceiptWriteInput {
  // Strip forbidden fields defensively; the caller is then refused
  // by canUseServerPsvReceiptWriter only if they passed forbidden
  // fields directly through some other path. This prevents a buggy
  // caller from accidentally upgrading the receipt's truth tier
  // through this helper.
  const {
    psvReceiptId,
    psvCandidateId,
    receiptCandidateId,
    requestId,
    claimId,
    claimType,
    promotedAt,
    promotedBy,
    sourceBasis,
    attributedResponder,
    scope,
    limitations,
    freshness,
  } = options.receipt as ServerPsvReceiptWriteInput['receipt'];
  return {
    receipt: {
      psvReceiptId,
      psvCandidateId,
      receiptCandidateId,
      requestId,
      claimId,
      claimType,
      promotedAt,
      promotedBy,
      sourceBasis,
      attributedResponder,
      scope,
      limitations,
      freshness,
    },
    correlationId: options.correlationId,
    auditEvent: options.auditEvent,
    idempotencyKey: options.idempotencyKey,
    dryRun: options.dryRun,
  };
}

/**
 * The reference deferred writer. This is the BACKEND-2 default. It
 * NEVER persists. Returns `status: 'deferred'` for valid input,
 * `status: 'failed'` with a structural reason for invalid input,
 * `status: 'dry_run'` when the caller asked for a dry run.
 */
export function createDeferredServerPsvReceiptWriter(): ServerPsvReceiptWriter {
  return {
    kind: 'deferred',
    async attempt(
      input: ServerPsvReceiptWriteInput,
    ): Promise<ServerPsvReceiptWriteResult> {
      const failure = canUseServerPsvReceiptWriter(input);
      const preservedReceipt = input.receipt;

      if (failure) {
        return {
          status: 'failed',
          persisted: false,
          failureReason: failure,
          message:
            failure === 'forbidden_truth_tier_field'
              ? 'Input carries a forbidden truth-tier field (decisionGrade / proofTier / globalCredentialTruth). The boundary refuses; no row was written.'
              : failure === 'client_supplied_persisted_flag'
                ? 'Input carries a client-supplied persisted/confirmation field. The boundary refuses; only a real writer may emit a confirmation.'
                : 'Input is missing one or more required fields (psvReceiptId / scope / limitations / sourceBasis / attributedResponder / freshness / correlationId). The boundary refuses; no row was written.',
          preservedReceipt,
        };
      }

      if (input.dryRun) {
        return {
          status: 'dry_run',
          persisted: false,
          message:
            'Dry run only. Input shape passed structural validation; no row was written.',
          preservedReceipt,
        };
      }

      return {
        status: 'deferred',
        persisted: false,
        message: DEFER_MESSAGE,
        preservedReceipt,
      };
    },
  };
}

/**
 * The reference unavailable writer. Used when the environment has
 * no writer configured at all.
 */
export function createUnavailableServerPsvReceiptWriter(): ServerPsvReceiptWriter {
  return {
    kind: 'deferred',
    async attempt(
      input: ServerPsvReceiptWriteInput,
    ): Promise<ServerPsvReceiptWriteResult> {
      return {
        status: 'unavailable',
        persisted: false,
        failureReason: 'writer_unavailable',
        message: UNAVAILABLE_MESSAGE,
        preservedReceipt: input.receipt,
      };
    },
  };
}

interface WriteWithConfirmationOptions {
  writer: ServerPsvReceiptWriter;
  input: ServerPsvReceiptWriteInput;
}

/**
 * Pure orchestrator: invoke a writer and validate its result. The
 * boundary refuses any "persisted" claim that does not carry a
 * confirmation with `writerMode in {repository, external}`. This
 * catches a buggy or hostile writer that returns persisted=true
 * without confirming.
 */
export async function writePsvReceiptWithConfirmation(
  options: WriteWithConfirmationOptions,
): Promise<ServerPsvReceiptWriteResult> {
  const result = await options.writer.attempt(options.input);

  if (result.status === 'persisted') {
    if (!result.confirmation) {
      // Buggy/hostile writer claim. Downgrade defensively.
      return {
        status: 'failed',
        persisted: false,
        failureReason: 'invalid_writer_confirmation',
        message:
          "Writer reported status='persisted' without a confirmation. The boundary downgraded the result; no row is treated as persisted.",
        preservedReceipt: result.preservedReceipt,
      };
    }
    if (
      result.confirmation.writerMode !== 'repository' &&
      result.confirmation.writerMode !== 'external'
    ) {
      return {
        status: 'failed',
        persisted: false,
        failureReason: 'invalid_writer_confirmation',
        message:
          "Writer confirmation has an invalid writerMode (must be 'repository' or 'external'). The boundary downgraded the result; no row is treated as persisted.",
        preservedReceipt: result.preservedReceipt,
      };
    }
    if (result.persisted !== true) {
      // Status says persisted but flag says not. Trust the flag.
      return {
        status: 'failed',
        persisted: false,
        failureReason: 'invalid_writer_confirmation',
        message:
          "Writer reported status='persisted' but persisted=false. The boundary downgraded the result.",
        preservedReceipt: result.preservedReceipt,
      };
    }
  } else if (result.persisted === true) {
    // Non-persisted status with persisted=true. Reject.
    return {
      status: 'failed',
      persisted: false,
      failureReason: 'invalid_writer_confirmation',
      message:
        "Writer reported persisted=true with a non-persisted status. The boundary downgraded the result.",
      preservedReceipt: result.preservedReceipt,
    };
  }

  return result;
}

/**
 * Plain-language explanation of a result. Surfaced verbatim by the
 * review surface and route handler.
 */
export function explainServerWriterResult(
  result: ServerPsvReceiptWriteResult,
): string {
  const head = `[${result.status}] persisted=${String(result.persisted)}`;
  const reason = result.failureReason
    ? ` (failureReason=${result.failureReason})`
    : '';
  const confirmation = result.confirmation
    ? ` (writerMode=${result.confirmation.writerMode}, persistedRowId=${result.confirmation.persistedRowId})`
    : '';
  return `${head}${reason}${confirmation}: ${result.message}`;
}

/**
 * Helper for surfacing the boundary's contribution into an
 * IssuerAuditWriteResult (see auditPersistence.ts). The boundary
 * never claims persistence; this maps a deferred result to the
 * audit-write contract for downstream replay surfaces.
 */
export function asAuditWriteResult(
  result: ServerPsvReceiptWriteResult,
): IssuerAuditWriteResult {
  return {
    status:
      result.status === 'persisted'
        ? 'persisted'
        : result.status === 'failed'
          ? 'failed'
          : result.status === 'unavailable'
            ? 'unavailable'
            : 'pending_not_written',
    mode:
      result.status === 'persisted'
        ? 'repository'
        : result.status === 'unavailable'
          ? 'none'
          : 'demo',
    persisted: result.persisted,
    message: result.message,
    error: result.failureReason
      ? { code: result.failureReason, message: result.message }
      : undefined,
  };
}
