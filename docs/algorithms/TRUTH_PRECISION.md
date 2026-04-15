# VitalCV Output Truth Precision

## 1. Output Contract
All system outputs, documentation, and agent telemetry MUST:
- Explicitly distinguish between **real-time execution** and **cached execution**.
- Explicitly distinguish between **inferred metrics** (e.g. theoretical extrapolations) and **measured metrics** (e.g. captured via real tracing).

## 2. Correct Terminology
Terms implying absolute states must be clarified.
- Do not use: "latency_independent".
- Use: "decision_path_latency_independent_from_external_sources" AND "external_latency_shifted_to_async_ingest".

## 3. Global Application
This precision contract applies to:
- All Load Test outputs and reports.
- All Macro-Architecture output JSONs.
- All System Status logs.
- All conversational Agent outputs explaining the system to human engineers.
