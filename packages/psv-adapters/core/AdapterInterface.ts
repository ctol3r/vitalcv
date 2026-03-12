import { trace, SpanStatusCode, type Tracer } from '@opentelemetry/api';
import { hashSensitiveInput, redactPayloadForLog, sha256Hex, stableSerialize } from './ProvenanceTracker';
import type { CredentialFactBatch } from './CredentialFactMapper';

export type SourceMode =
  | 'PUBLIC_API'
  | 'LICENSED_API'
  | 'BULK_FILE'
  | 'PORTAL_WORKFLOW';

export type AdapterDescriptor = Readonly<{
  sourceId: string;
  displayName: string;
  sourceMode: SourceMode;
  version: string;
  operational: boolean;
  supportsPolling: boolean;
  supportsWebhook: boolean;
  supportsEnrollment: boolean;
}>;

export type ExecutionTraceContext = Readonly<{
  traceparent?: string;
  tracer?: Tracer;
}>;

export type AdapterRequestContext = Readonly<{
  trace?: ExecutionTraceContext;
  requestedBy?: string;
}>;

export interface CredentialSourceAdapter {
  readonly descriptor: AdapterDescriptor;
}

export interface IdentityLookupAdapter extends CredentialSourceAdapter {
  lookupByNpi(npi: string, context?: AdapterRequestContext): Promise<CredentialFactBatch>;
  lookupByNameState(name: string, state: string, context?: AdapterRequestContext): Promise<CredentialFactBatch>;
}

export interface MonitoringSourceAdapter extends CredentialSourceAdapter {
  enrollMonitoring(input: Record<string, unknown>, context?: AdapterRequestContext): Promise<CredentialFactBatch>;
  pollUpdates(input: Record<string, unknown>, context?: AdapterRequestContext): Promise<CredentialFactBatch>;
  ingestWebhook(input: Record<string, unknown>, context?: AdapterRequestContext): Promise<CredentialFactBatch>;
}

export type RetryPolicy = Readonly<{
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}>;

export type HttpRequest = Readonly<{
  key: string;
  url: string;
  method?: 'GET' | 'POST';
  headers?: Readonly<Record<string, string>>;
  body?: string;
}>;

export type HttpResponse = Readonly<{
  ok: boolean;
  status: number;
  headers: Readonly<Record<string, string>>;
  body: unknown;
}>;

export type DeadLetterRecord = Readonly<{
  key: string;
  url: string;
  occurredAt: string;
  error: string;
  requestDigest: string;
  metadata: Record<string, unknown>;
}>;

export interface DeadLetterQueue {
  push(record: DeadLetterRecord): void;
  list(): readonly DeadLetterRecord[];
}

export type CircuitBreakerState = Readonly<{
  key: string;
  failures: number;
  openedAt?: string;
  nextRetryAt?: string;
}>;

export interface CircuitBreaker {
  assertCanRequest(key: string): void;
  recordSuccess(key: string): void;
  recordFailure(key: string, nowIso: string): void;
  snapshot(key: string): CircuitBreakerState;
}

export interface JsonHttpTransport {
  execute(request: HttpRequest, context?: AdapterRequestContext): Promise<HttpResponse>;
}

export type JsonHttpTransportOptions = Readonly<{
  fetcher?: typeof fetch;
  retryPolicy?: Partial<RetryPolicy>;
  deadLetters?: DeadLetterQueue;
  circuitBreaker?: CircuitBreaker;
}>;

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 250,
  maxDelayMs: 4_000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeHeaders(headers: Headers): Record<string, string> {
  const normalized: Record<string, string> = {};
  headers.forEach((value, key) => {
    normalized[key] = value;
  });
  return normalized;
}

function assertTls(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new AdapterTransportError(`TLS is required for adapter integrations: ${url}`);
  }
}

function getTracer(context?: AdapterRequestContext): Tracer {
  return context?.trace?.tracer ?? trace.getTracer('vitalcv.psv-adapters');
}

function computeBackoffMs(attempt: number, retryAfterHeader: string | undefined, policy: RetryPolicy): number {
  if (retryAfterHeader) {
    const asInt = Number.parseInt(retryAfterHeader, 10);
    if (Number.isFinite(asInt)) {
      return Math.max(asInt * 1_000, policy.baseDelayMs);
    }

    const asDate = Date.parse(retryAfterHeader);
    if (Number.isFinite(asDate)) {
      return Math.max(asDate - Date.now(), policy.baseDelayMs);
    }
  }

  const computed = policy.baseDelayMs * 2 ** attempt;
  return Math.min(computed, policy.maxDelayMs);
}

export class AdapterTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdapterTransportError';
  }
}

export class InMemoryDeadLetterQueue implements DeadLetterQueue {
  private readonly entries: DeadLetterRecord[] = [];

  push(record: DeadLetterRecord): void {
    this.entries.push(record);
  }

  list(): readonly DeadLetterRecord[] {
    return Object.freeze([...this.entries]);
  }
}

export class MemoryCircuitBreaker implements CircuitBreaker {
  private readonly states = new Map<string, CircuitBreakerState>();

  constructor(
    private readonly config: Readonly<{
      failureThreshold: number;
      openIntervalMs: number;
    }> = {
      failureThreshold: 3,
      openIntervalMs: 30_000,
    },
  ) {}

  assertCanRequest(key: string): void {
    const snapshot = this.states.get(key);
    if (!snapshot?.nextRetryAt) {
      return;
    }

    if (Date.parse(snapshot.nextRetryAt) > Date.now()) {
      throw new AdapterTransportError(`Circuit breaker open for ${key}`);
    }
  }

  recordSuccess(key: string): void {
    this.states.set(
      key,
      Object.freeze({
        key,
        failures: 0,
      }),
    );
  }

  recordFailure(key: string, nowIso: string): void {
    const current = this.states.get(key);
    const failures = (current?.failures ?? 0) + 1;
    const nextRetryAt =
      failures >= this.config.failureThreshold
        ? new Date(Date.parse(nowIso) + this.config.openIntervalMs).toISOString()
        : undefined;

    this.states.set(
      key,
      Object.freeze({
        key,
        failures,
        openedAt: failures >= this.config.failureThreshold ? nowIso : current?.openedAt,
        nextRetryAt,
      }),
    );
  }

  snapshot(key: string): CircuitBreakerState {
    return (
      this.states.get(key) ??
      Object.freeze({
        key,
        failures: 0,
      })
    );
  }
}

export function createJsonHttpTransport(options: JsonHttpTransportOptions = {}): JsonHttpTransport {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const retryPolicy = {
    ...DEFAULT_RETRY_POLICY,
    ...(options.retryPolicy ?? {}),
  };
  const deadLetters = options.deadLetters ?? new InMemoryDeadLetterQueue();
  const circuitBreaker = options.circuitBreaker ?? new MemoryCircuitBreaker();

  return {
    async execute(request: HttpRequest, context?: AdapterRequestContext): Promise<HttpResponse> {
      assertTls(request.url);
      const tracer = getTracer(context);
      const requestDigest = sha256Hex(
        stableSerialize({
          url: request.url,
          method: request.method ?? 'GET',
          body: request.body ?? null,
        }),
      );

      return tracer.startActiveSpan(
        `adapter_http ${request.key}`,
        async (span) => {
          span.setAttribute('vitalcv.adapter.key', request.key);
          span.setAttribute('vitalcv.adapter.request.sha256', requestDigest);
          span.setAttribute('vitalcv.adapter.subject.sha256', hashSensitiveInput(request.key));

          try {
            circuitBreaker.assertCanRequest(request.key);

            let attempt = 0;
            let lastError: Error | null = null;

            while (attempt <= retryPolicy.maxRetries) {
              try {
                const response = await fetcher(request.url, {
                  method: request.method ?? 'GET',
                  headers: request.headers,
                  body: request.body,
                });

                const headers = normalizeHeaders(response.headers);
                const bodyText = await response.text();
                let body: unknown = bodyText;

                if ((headers['content-type'] ?? '').includes('json')) {
                  body = bodyText ? JSON.parse(bodyText) : null;
                } else if (bodyText.startsWith('{') || bodyText.startsWith('[')) {
                  body = JSON.parse(bodyText);
                }

                if (response.status === 429 && attempt < retryPolicy.maxRetries) {
                  await sleep(computeBackoffMs(attempt, headers['retry-after'], retryPolicy));
                  attempt += 1;
                  continue;
                }

                if (!response.ok) {
                  throw new AdapterTransportError(`HTTP ${response.status} from ${request.url}`);
                }

                circuitBreaker.recordSuccess(request.key);
                span.setAttribute('http.response.status_code', response.status);
                span.setStatus({ code: SpanStatusCode.OK });

                return Object.freeze({
                  ok: response.ok,
                  status: response.status,
                  headers,
                  body,
                });
              } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt >= retryPolicy.maxRetries) {
                  break;
                }

                await sleep(computeBackoffMs(attempt, undefined, retryPolicy));
                attempt += 1;
              }
            }

            const nowIso = new Date().toISOString();
            circuitBreaker.recordFailure(request.key, nowIso);
            deadLetters.push(
              Object.freeze({
                key: request.key,
                url: request.url,
                occurredAt: nowIso,
                error: lastError?.message ?? 'Unknown adapter transport failure',
                requestDigest,
                metadata: {
                  method: request.method ?? 'GET',
                  headers: redactPayloadForLog(request.headers ?? {}),
                },
              }),
            );

            throw lastError ?? new AdapterTransportError(`Transport failed for ${request.key}`);
          } catch (error) {
            span.recordException(error as Error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error instanceof Error ? error.message : 'adapter transport failed',
            });
            throw error;
          } finally {
            span.end();
          }
        },
      );
    },
  };
}
