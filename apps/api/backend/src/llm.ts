import {
  context,
  SpanKind,
  SpanStatusCode,
  type Span,
  type Attributes,
  type Tracer,
} from '@opentelemetry/api';
import {
  estimateTokenCount,
  getGenAiTracer,
  isContentCaptureEnabled,
  maybeTruncate,
  parentContextFromTraceparent,
  serializeForHash,
  sha256Hex,
  type TraceAttributes,
} from './telemetry';

export type AgentInvocationOptions = {
  agentName: string;
  model: string;
  provider?: string;
  input: unknown;
  traceparent?: string;
  attributes?: TraceAttributes;
  tracer?: Tracer;
};

export type AgentInvocationResult<TOutput> = {
  output: TOutput;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

const DEFAULT_PROVIDER = 'openai';

export async function invokeAgentModel<TOutput>(
  options: AgentInvocationOptions,
  invoke: () => Promise<AgentInvocationResult<TOutput>>,
): Promise<TOutput> {
  const tracer = options.tracer ?? getGenAiTracer();
  const parentContext = parentContextFromTraceparent(options.traceparent ?? process.env.OTEL_TRACEPARENT);
  const inputBody = serializeForHash(options.input);

  return context.with(parentContext, async () =>
    tracer.startActiveSpan(
      `invoke_agent ${options.model}`,
      { kind: SpanKind.INTERNAL },
      async (span: Span) => {
        try {
          const attributes: Attributes = {
            'gen_ai.agent.name': options.agentName,
            'gen_ai.operation.name': 'chat',
            'gen_ai.system': options.provider ?? DEFAULT_PROVIDER,
            'gen_ai.request.model': options.model,
            'gen_ai.request.input_sha256': sha256Hex(inputBody),
            ...options.attributes,
          };

          span.setAttributes(attributes);

          if (isContentCaptureEnabled()) {
            span.setAttribute('gen_ai.request.content', maybeTruncate(inputBody));
          }

          const result = await invoke();

          const inputTokens =
            result.usage?.inputTokens ??
            estimateTokenCount(options.input);
          const outputTokens =
            result.usage?.outputTokens ??
            estimateTokenCount(result.output);

          span.setAttribute('gen_ai.response.model', options.model);
          span.setAttribute('gen_ai.usage.input_tokens', inputTokens);
          span.setAttribute('gen_ai.usage.output_tokens', outputTokens);

          if (isContentCaptureEnabled()) {
            span.setAttribute('gen_ai.response.content', maybeTruncate(serializeForHash(result.output)));
          }

          span.setStatus({ code: SpanStatusCode.OK });
          return result.output;
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'agent invocation failed',
          });
          throw error;
        } finally {
          span.end();
        }
      },
    ),
  );
}
