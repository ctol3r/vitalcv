import { context, type Tracer } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { invokeAgentModel } from '../src/llm';
import { withToolSpan } from '../src/tools/tracing';
import { sha256Hex } from '../src/telemetry';

describe('gen ai tracing wrappers', () => {
  let provider: BasicTracerProvider;
  let exporter: InMemorySpanExporter;
  let tracer: Tracer;

  beforeEach(() => {
    delete process.env.OTEL_CAPTURE_CONTENT;
    exporter = new InMemorySpanExporter();
    provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
    tracer = provider.getTracer('test.genai');
  });

  afterEach(async () => {
    await provider.shutdown();
    context.disable();
    exporter.reset();
    delete process.env.OTEL_CAPTURE_CONTENT;
  });

  it('records model invocation attributes without storing content by default', async () => {
    const input = { prompt: 'verify clinician ABC123' };
    const expectedInputHash = sha256Hex(JSON.stringify(input));

    const output = await invokeAgentModel(
      {
        agentName: 'trust-observer',
        model: 'gpt-4o-mini',
        provider: 'openai',
        input,
        tracer,
      },
      async () => ({
        output: { status: 'ok' },
        usage: {
          inputTokens: 24,
          outputTokens: 12,
        },
      }),
    );

    expect(output).toEqual({ status: 'ok' });

    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);

    const [root] = spans;
    expect(root.name).toBe('invoke_agent gpt-4o-mini');
    expect(root.attributes['gen_ai.agent.name']).toBe('trust-observer');
    expect(root.attributes['gen_ai.request.model']).toBe('gpt-4o-mini');
    expect(root.attributes['gen_ai.system']).toBe('openai');
    expect(root.attributes['gen_ai.request.input_sha256']).toBe(expectedInputHash);
    expect(root.attributes['gen_ai.usage.input_tokens']).toBe(24);
    expect(root.attributes['gen_ai.usage.output_tokens']).toBe(12);
    expect(root.attributes['gen_ai.request.content']).toBeUndefined();
    expect(root.attributes['gen_ai.response.content']).toBeUndefined();
  });

  it('captures prompt/response content only when OTEL_CAPTURE_CONTENT=true', async () => {
    process.env.OTEL_CAPTURE_CONTENT = 'true';

    await invokeAgentModel(
      {
        agentName: 'trust-observer',
        model: 'gpt-4o-mini',
        provider: 'openai',
        input: { prompt: 'safe content capture test' },
        tracer,
      },
      async () => ({
        output: { answer: 'ok' },
      }),
    );

    const [root] = exporter.getFinishedSpans();
    expect(root.attributes['gen_ai.request.content']).toBeDefined();
    expect(root.attributes['gen_ai.response.content']).toBeDefined();
  });

  it('creates a child tool span on the same trace as the agent invocation', async () => {
    await invokeAgentModel(
      {
        agentName: 'trust-observer',
        model: 'gpt-4o-mini',
        provider: 'openai',
        input: { prompt: 'check tool span linkage' },
        tracer,
      },
      async () => {
        await withToolSpan(
          {
            toolName: 'npi_lookup',
            input: { npi: '1234567893' },
            tracer,
          },
          async () => ({ found: true }),
        );

        return {
          output: { status: 'ok' },
          usage: { inputTokens: 8, outputTokens: 4 },
        };
      },
    );

    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(2);

    const root = spans.find((span) => span.name === 'invoke_agent gpt-4o-mini');
    const tool = spans.find((span) => span.name === 'execute_tool npi_lookup');

    expect(root).toBeDefined();
    expect(tool).toBeDefined();
    expect(tool?.attributes['gen_ai.tool.name']).toBe('npi_lookup');
    expect(tool?.parentSpanContext?.spanId).toBe(root?.spanContext().spanId);
    expect(tool?.spanContext().traceId).toBe(root?.spanContext().traceId);
  });
});
