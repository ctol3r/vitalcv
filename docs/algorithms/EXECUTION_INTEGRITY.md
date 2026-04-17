# VitalCV Execution Integrity Guardrails

## 1. No Theoretical Output
When an instruction dictates "run", "measure", or "execute", the system **MUST** run a real tool and return actual measured output. It **MUST NOT** simulate, infer, or hallucinate metrics based on conceptual logic.

## 2. Failure Mode
If real execution cannot be performed (e.g., due to sandboxing, missing dependencies, or lack of environment access), the system must explicitly fail with:
`{"execution_status": "blocked", "reason": "real execution not possible in this environment", "required_action": "run via external tool (k6/autocannon)"}`

## 3. No Fallback to Simulation
The system is explicitly forbidden from replacing missing execution data with theoretical reasoning. A blocked execution is a blocked execution.

This rule applies globally to all load tests, performance metrics, and validation outputs.
