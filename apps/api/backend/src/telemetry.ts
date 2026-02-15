import crypto from 'crypto';
import {
  context,
  propagation,
  trace,
  type Context,
  type Tracer,
  type Attributes,
  type AttributeValue,
} from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  ExportResultCode,
  hrTimeToNanoseconds,
  W3CTraceContextPropagator,
} from '@opentelemetry/core';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  BasicTracerProvider,
  type ReadableSpan,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-base';

type PrimitiveAttribute = string | number | boolean;

export type TraceAttributes = Record<string, PrimitiveAttribute>;

const DEFAULT_OTLP_TRACES_ENDPOINT = 'http://localhost:4318/v1/traces';
const DEFAULT_SERVICE_NAME = 'vitalcv-agent';
const DEFAULT_MAX_CAPTURE_CHARS = 4096;

let provider: BasicTracerProvider | null = null;
let initialized = false;

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseHeaders(headers: string | undefined): Record<string, string> {
  if (!headers) return {};

  const parsed: Record<string, string> = {};
  for (const entry of headers.split(',')) {
    const [rawKey, ...rawValue] = entry.split('=');
    const key = rawKey?.trim();
    if (!key) continue;

    const value = rawValue.join('=').trim();
    if (!value) continue;

    parsed[key] = value;
  }

  return parsed;
}

function resolveTracesEndpoint(): string {
  const tracesEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim();
  if (tracesEndpoint) return tracesEndpoint;

  const sharedEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!sharedEndpoint) return DEFAULT_OTLP_TRACES_ENDPOINT;
  if (sharedEndpoint.endsWith('/v1/traces')) return sharedEndpoint;

  return `${sharedEndpoint.replace(/\/$/, '')}/v1/traces`;
}

function serialize(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

function toAttributeEntries(attributes: Attributes): Array<{ key: string; value: unknown }> {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ({ key, value: toOtlpAttributeValue(value as AttributeValue) }));
}

function toOtlpAttributeValue(value: AttributeValue): unknown {
  if (value === null || value === undefined) {
    return { stringValue: 'null' };
  }

  if (typeof value === 'string') {
    return { stringValue: value };
  }

  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { intValue: String(value) };
    }
    return { doubleValue: value };
  }

  if (typeof value === 'boolean') {
    return { boolValue: value };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((entry) => toOtlpAttributeValue(entry as AttributeValue)),
      },
    };
  }

  return { stringValue: String(value) };
}

class OtlpHttpSpanExporter implements SpanExporter {
  private readonly endpoint: string;
  private readonly headers: Record<string, string>;

  constructor(endpoint: string, headers: Record<string, string>) {
    this.endpoint = endpoint;
    this.headers = headers;
  }

  export(
    spans: ReadableSpan[],
    resultCallback: (result: { code: ExportResultCode; error?: Error }) => void,
  ): void {
    const body = JSON.stringify({
      resourceSpans: this.toResourceSpans(spans),
    });

    void fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...this.headers,
      },
      body,
    })
      .then((response) => {
        if (!response.ok) {
          resultCallback({
            code: ExportResultCode.FAILED,
            error: new Error(`OTLP export failed with status ${response.status}`),
          });
          return;
        }

        resultCallback({ code: ExportResultCode.SUCCESS });
      })
      .catch((error) => {
        resultCallback({
          code: ExportResultCode.FAILED,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
  }

  async shutdown(): Promise<void> {
    return Promise.resolve();
  }

  private toResourceSpans(spans: ReadableSpan[]) {
    const groups = new Map<string, {
      resourceAttributes: Array<{ key: string; value: unknown }>;
      scopes: Map<string, { name: string; version?: string; spans: unknown[] }>;
    }>();

    for (const span of spans) {
      const resourceAttrs = toAttributeEntries(span.resource.attributes);
      const resourceKey = JSON.stringify(resourceAttrs);
      const scopeName = span.instrumentationScope.name || 'unknown';
      const scopeVersion = span.instrumentationScope.version;
      const scopeKey = `${scopeName}@${scopeVersion ?? ''}`;

      if (!groups.has(resourceKey)) {
        groups.set(resourceKey, {
          resourceAttributes: resourceAttrs,
          scopes: new Map(),
        });
      }

      const resourceGroup = groups.get(resourceKey)!;
      if (!resourceGroup.scopes.has(scopeKey)) {
        resourceGroup.scopes.set(scopeKey, {
          name: scopeName,
          version: scopeVersion,
          spans: [],
        });
      }

      resourceGroup.scopes.get(scopeKey)!.spans.push({
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId,
        ...(span.parentSpanContext?.spanId ? { parentSpanId: span.parentSpanContext.spanId } : {}),
        name: span.name,
        kind: span.kind,
        startTimeUnixNano: String(hrTimeToNanoseconds(span.startTime)),
        endTimeUnixNano: String(hrTimeToNanoseconds(span.endTime)),
        attributes: toAttributeEntries(span.attributes),
        status: {
          code: span.status.code,
          ...(span.status.message ? { message: span.status.message } : {}),
        },
      });
    }

    return Array.from(groups.values()).map((group) => ({
      resource: {
        attributes: group.resourceAttributes,
      },
      scopeSpans: Array.from(group.scopes.values()).map((scope) => ({
        scope: {
          name: scope.name,
          ...(scope.version ? { version: scope.version } : {}),
        },
        spans: scope.spans,
      })),
    }));
  }
}

export function getGenAiTracer(): Tracer {
  return trace.getTracer('vitalcv.genai');
}

export function isContentCaptureEnabled(): boolean {
  return parseBool(process.env.OTEL_CAPTURE_CONTENT, false);
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function serializeForHash(value: unknown): string {
  return serialize(value);
}

export function estimateTokenCount(value: unknown): number {
  const serialized = serialize(value);
  return Math.max(1, Math.ceil(Buffer.byteLength(serialized, 'utf8') / 4));
}

export function maybeTruncate(value: string, maxChars = DEFAULT_MAX_CAPTURE_CHARS): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}...[truncated]`;
}

export function initializeTelemetry(serviceName = DEFAULT_SERVICE_NAME): void {
  if (initialized) return;
  if (!parseBool(process.env.OTEL_ENABLED, true)) return;

  const configuredServiceName = process.env.OTEL_SERVICE_NAME?.trim() || serviceName;
  const resource = resourceFromAttributes({
    'service.name': configuredServiceName,
    ...(process.env.NODE_ENV ? { 'deployment.environment': process.env.NODE_ENV } : {}),
  });

  const exporter = new OtlpHttpSpanExporter(
    resolveTracesEndpoint(),
    parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
  );

  provider = new BasicTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });

  trace.setGlobalTracerProvider(provider);
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  initialized = true;
}

export async function shutdownTelemetry(): Promise<void> {
  if (!provider) return;

  try {
    await provider.shutdown();
  } finally {
    context.disable();
    propagation.disable();
    provider = null;
    initialized = false;
  }
}

export function parentContextFromTraceparent(traceparent?: string): Context {
  const normalized = traceparent?.trim();
  if (!normalized) return context.active();
  return propagation.extract(context.active(), { traceparent: normalized });
}
