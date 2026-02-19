import {
  context,
  SpanKind,
  SpanStatusCode,
  type Span,
  trace,
  type Attributes,
  type Tracer,
} from '@opentelemetry/api';
import {
  getGenAiTracer,
  isContentCaptureEnabled,
  maybeTruncate,
  parentContextFromTraceparent,
  serializeForHash,
  sha256Hex,
  type TraceAttributes,
} from '../telemetry';

type ToolSpanOptions = {
  toolName: string;
  input?: unknown;
  traceparent?: string;
  tracer?: Tracer;
  attributes?: TraceAttributes;
};

type PrismaSpanOptions = {
  operation: string;
  input?: unknown;
  traceparent?: string;
  tracer?: Tracer;
};

type HttpSpanOptions = {
  operation: string;
  method?: string;
  url?: string;
  input?: unknown;
  traceparent?: string;
  tracer?: Tracer;
};

type NpiLookupSpanOptions = {
  npi: string;
  input?: unknown;
  traceparent?: string;
  tracer?: Tracer;
};

function scrubUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    return parsed.toString();
  } catch {
    return url.split('?')[0] ?? url;
  }
}

function spanParentContext(traceparent?: string) {
  if (trace.getSpan(context.active())) return context.active();
  return parentContextFromTraceparent(traceparent ?? process.env.OTEL_TRACEPARENT);
}

export async function withToolSpan<TOutput>(
  options: ToolSpanOptions,
  invoke: () => Promise<TOutput>,
): Promise<TOutput> {
  const tracer = options.tracer ?? getGenAiTracer();
  const parentContext = spanParentContext(options.traceparent);
  const inputBody = options.input == null ? '' : serializeForHash(options.input);

  return context.with(parentContext, async () =>
    tracer.startActiveSpan(
      `execute_tool ${options.toolName}`,
      { kind: SpanKind.CLIENT },
      async (span: Span) => {
        try {
          const attributes: Attributes = {
            'gen_ai.operation.name': 'execute_tool',
            'gen_ai.tool.name': options.toolName,
            ...options.attributes,
          };

          if (options.input != null) {
            attributes['gen_ai.tool.input_sha256'] = sha256Hex(inputBody);
          }

          span.setAttributes(attributes);

          if (options.input != null && isContentCaptureEnabled()) {
            span.setAttribute('gen_ai.tool.input', maybeTruncate(inputBody));
          }

          const output = await invoke();
          span.setStatus({ code: SpanStatusCode.OK });
          return output;
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'tool call failed',
          });
          throw error;
        } finally {
          span.end();
        }
      },
    ),
  );
}

export async function withPrismaToolSpan<TOutput>(
  options: PrismaSpanOptions,
  invoke: () => Promise<TOutput>,
): Promise<TOutput> {
  return withToolSpan(
    {
      toolName: `prisma.${options.operation}`,
      input: options.input,
      traceparent: options.traceparent,
      tracer: options.tracer,
      attributes: {
        'db.system': 'postgresql',
      },
    },
    invoke,
  );
}

export async function withHttpToolSpan<TOutput>(
  options: HttpSpanOptions,
  invoke: () => Promise<TOutput>,
): Promise<TOutput> {
  return withToolSpan(
    {
      toolName: `http.${options.operation}`,
      input: options.input,
      traceparent: options.traceparent,
      tracer: options.tracer,
      attributes: {
        ...(options.method ? { 'http.request.method': options.method.toUpperCase() } : {}),
        ...(options.url ? { 'url.full': scrubUrl(options.url) } : {}),
      },
    },
    invoke,
  );
}

export async function withNpiLookupToolSpan<TOutput>(
  options: NpiLookupSpanOptions,
  invoke: () => Promise<TOutput>,
): Promise<TOutput> {
  return withToolSpan(
    {
      toolName: 'npi_lookup',
      input: options.input,
      traceparent: options.traceparent,
      tracer: options.tracer,
      attributes: {
        'vitalcv.npi.sha256': sha256Hex(options.npi),
      },
    },
    invoke,
  );
}
