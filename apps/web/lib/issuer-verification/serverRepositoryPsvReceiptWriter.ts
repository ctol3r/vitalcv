import 'server-only';

import type {
  ServerPsvReceiptWriteInput,
  ServerPsvReceiptWriteResult,
  ServerPsvReceiptWriter,
} from './serverPsvReceiptWriter';
import { canUseServerPsvReceiptWriter } from './serverPsvReceiptWriter';

/**
 * ISSUER-10 — the real server-only PSV receipt writer.
 *
 * This is the writer BACKEND-2 declared as the boundary and left unimplemented,
 * and the one ISSUER-9 condition 2 requires ("server-only … confirms each row
 * before reporting persisted, and is under test").
 *
 * Why it speaks HTTP rather than importing the repository:
 *   ISSUER-8 closed the direct path on purpose. The Prisma-bound repository
 *   lives in the backend package, and importing it here would pull server-only
 *   Prisma into the web client bundle — the tests assert that no such import
 *   exists. The backend exposes POST /api/internal/issuer/psv-receipts as the
 *   client-safe boundary; this module is its caller.
 *
 * Truth contract:
 *   - OFF by default. Persistence requires BOTH the web-side deployment flag
 *     (ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED === 'true') AND an explicit
 *     `enableRepositoryWrites: true` in the config. Either alone → deferred.
 *     The backend independently enforces the same pair, so a misconfigured web
 *     deploy cannot write to a backend that has not opted in.
 *   - `persisted: true` is returned ONLY when the backend confirms a row with
 *     writerMode 'repository'. A backend that claims persistence without a
 *     confirmation is downgraded to `failed` by
 *     `writePsvReceiptWithConfirmation`, which every caller should route
 *     through.
 *   - The receipt is preserved verbatim on every outcome, including refusals.
 *     Timestamps (`promotedAt`, `freshness.issuedAt`, `freshness.staleAfter`)
 *     are passed through untouched — this module never substitutes its own
 *     clock for an observed time.
 *   - A transport failure is `failed`, never a silent success and never a
 *     retry that could double-write. Idempotency is the caller's key.
 */

export interface ServerRepositoryPsvReceiptWriterConfig {
  /** Explicit caller intent. Required in addition to the deployment flag. */
  enableRepositoryWrites?: boolean;
  /** Backend base URL. Defaults to the standard internal API base env vars. */
  backendBaseUrl?: string;
  /**
   * Shared secret for the guarded backend route. Defaults to
   * ISSUER_PSV_RECEIPT_WRITER_SECRET. The backend fails closed without it, so
   * a missing secret produces a 403, never an anonymous write.
   */
  writerSecret?: string;
  /** Identifies who asked for the write; surfaced in the confirmation. */
  confirmedBy?: string;
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Request timeout in ms. */
  timeoutMs?: number;
}

/** Deployment-level opt-in. Anything but the literal 'true' is off. */
export function isServerPsvReceiptPersistenceEnabled(): boolean {
  return process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED === 'true';
}

function resolveBackendBaseUrl(config: ServerRepositoryPsvReceiptWriterConfig): string | undefined {
  return (
    config.backendBaseUrl ??
    process.env.BACKEND_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    undefined
  );
}

const DISABLED_MESSAGE =
  'Issuer PSV receipt persistence is not enabled for this deployment ' +
  '(ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED) or was not requested by the caller ' +
  '(enableRepositoryWrites). No row was written.';

const NO_BACKEND_MESSAGE =
  'No backend base URL is configured, so the client-safe write boundary is ' +
  'unreachable. No row was written.';

interface BackendWriteResponse {
  status?: string;
  persisted?: boolean;
  message?: string;
  field?: string;
  confirmation?: {
    confirmedAt?: string;
    confirmedBy?: string;
    writerMode?: string;
    persistedRowId?: string;
    alreadyPersisted?: boolean;
  };
}

/**
 * Create the repository-backed writer. Returns a writer whose `attempt` is
 * always safe to call: when persistence is off it reports `deferred` without
 * touching the network.
 */
export function createServerRepositoryPsvReceiptWriter(
  config: ServerRepositoryPsvReceiptWriterConfig = {},
): ServerPsvReceiptWriter {
  return {
    kind: 'repository',
    async attempt(input: ServerPsvReceiptWriteInput): Promise<ServerPsvReceiptWriteResult> {
      const preservedReceipt = input.receipt;

      // Structural refusals first — the same gate the deferred writer applies,
      // so an invalid input never reaches the network.
      const failure = canUseServerPsvReceiptWriter(input);
      if (failure) {
        return {
          status: 'failed',
          persisted: false,
          failureReason: failure,
          message:
            'Input failed the write-boundary structural check; no request was sent and no row was written.',
          preservedReceipt,
        };
      }

      if (!isServerPsvReceiptPersistenceEnabled() || config.enableRepositoryWrites !== true) {
        return {
          status: 'deferred',
          persisted: false,
          failureReason: 'writer_deferred_pending_schema_alignment',
          message: DISABLED_MESSAGE,
          preservedReceipt,
        };
      }

      const baseUrl = resolveBackendBaseUrl(config);
      if (!baseUrl) {
        return {
          status: 'unavailable',
          persisted: false,
          failureReason: 'writer_unavailable',
          message: NO_BACKEND_MESSAGE,
          preservedReceipt,
        };
      }

      if (input.dryRun) {
        return {
          status: 'dry_run',
          persisted: false,
          message:
            'Dry run only. Input passed structural validation; no request was sent and no row was written.',
          preservedReceipt,
        };
      }

      const doFetch = config.fetchImpl ?? fetch;
      const writerSecret =
        config.writerSecret ?? process.env.ISSUER_PSV_RECEIPT_WRITER_SECRET;

      let response: Response;
      try {
        response = await doFetch(`${baseUrl.replace(/\/$/, '')}/api/internal/issuer/psv-receipts`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(writerSecret ? { 'x-issuer-writer-secret': writerSecret } : {}),
          },
          body: JSON.stringify({
            receipt: input.receipt,
            auditEvent: input.auditEvent,
            enableRepositoryWrites: true,
            confirmedBy: config.confirmedBy ?? 'web-server-repository-writer',
          }),
          signal: AbortSignal.timeout(config.timeoutMs ?? 10_000),
        });
      } catch {
        return {
          status: 'failed',
          persisted: false,
          failureReason: 'repository_write_failed',
          message:
            'The write request to the backend boundary failed in transport. No persistence is claimed; retry with the same idempotencyKey.',
          preservedReceipt,
        };
      }

      let payload: BackendWriteResponse;
      try {
        payload = (await response.json()) as BackendWriteResponse;
      } catch {
        return {
          status: 'failed',
          persisted: false,
          failureReason: 'repository_write_failed',
          message:
            'The backend boundary returned an unreadable response body. No persistence is claimed.',
          preservedReceipt,
        };
      }

      if (!response.ok) {
        return {
          status: 'failed',
          persisted: false,
          failureReason: 'repository_write_failed',
          message:
            payload.message ??
            `The backend boundary refused the write (HTTP ${response.status}). No row was written.`,
          preservedReceipt,
        };
      }

      // A 200 with persisted:false is the normal deferred outcome. Never infer
      // success from the status code.
      if (payload.persisted !== true) {
        return {
          status: 'deferred',
          persisted: false,
          failureReason: 'writer_deferred_pending_schema_alignment',
          message: payload.message ?? DISABLED_MESSAGE,
          preservedReceipt,
        };
      }

      const confirmation = payload.confirmation;
      if (
        !confirmation ||
        confirmation.writerMode !== 'repository' ||
        !confirmation.persistedRowId ||
        !confirmation.confirmedAt
      ) {
        return {
          status: 'failed',
          persisted: false,
          failureReason: 'invalid_writer_confirmation',
          message:
            'The backend reported persistence without a valid repository confirmation. The boundary refuses to treat the row as persisted.',
          preservedReceipt,
        };
      }

      return {
        status: 'persisted',
        persisted: true,
        message: payload.message ?? 'Receipt persisted and confirmed by the repository writer.',
        confirmation: {
          confirmedAt: confirmation.confirmedAt,
          confirmedBy: confirmation.confirmedBy ?? 'backend',
          writerMode: 'repository',
          persistedRowId: confirmation.persistedRowId,
        },
        preservedReceipt,
      };
    },
  };
}
