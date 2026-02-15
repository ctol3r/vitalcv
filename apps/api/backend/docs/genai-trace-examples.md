# GenAI Trace Examples (Text-Only)

<!-- Screenshot (text): Agent invocation span -->
```text
Trace: 0f9fd7c7b6d0c73a9f91f992f6336bb8
Span: invoke_agent gpt-4o-mini
Attributes:
  service.name: vitalcv-agent
  gen_ai.agent.name: trust-observer
  gen_ai.system: openai
  gen_ai.operation.name: chat
  gen_ai.request.model: gpt-4o-mini
  gen_ai.request.input_sha256: 8c6c4a8c6e2b090b3c9f03d7e8f0e9f830a2bb8f6f1e8f6726d44fca9674aabf
  gen_ai.usage.input_tokens: 312
  gen_ai.usage.output_tokens: 96
```

<!-- Screenshot (text): Tool spans -->
```text
Trace: 0f9fd7c7b6d0c73a9f91f992f6336bb8
Parent Span: invoke_agent gpt-4o-mini
Child Spans:
  - execute_tool npi_lookup
      gen_ai.tool.name: npi_lookup
      vitalcv.npi.sha256: bce0f4d58f3e95f7232f5cc341f460f0823dc00c9f686f17f6f6ac8e0172ac46
  - execute_tool http.nppes.lookup
      gen_ai.tool.name: http.nppes.lookup
      http.request.method: GET
      url.full: https://npiregistry.cms.hhs.gov/api/
  - execute_tool prisma.auditEvent.create
      gen_ai.tool.name: prisma.auditEvent.create
      db.system: postgresql
```

<!-- Screenshot (text): CI root trace -->
```text
Workflow: CI / Install, Check, Build, Test
Trace ID: 906f6f325f6d2a4ea0174d48bc837f6f
traceparent: 00-906f6f325f6d2a4ea0174d48bc837f6f-3ba9aaf96f98bb9c-01
PR comment: CI root trace: https://observability.example/traces/906f6f325f6d2a4ea0174d48bc837f6f
```
