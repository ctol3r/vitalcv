# Multi-Agent Architecture (Batch 54)

## Overview

VitalCV uses a **multi-agent orchestration** pattern:

- **Orchestrator**: Receives events, classifies intent, fans out to specialized agents, reconciles results
- **Clinician Agent**: Manages holder/clinician UX flows (profile, consent, wallet interactions)
- **Verifier Agent**: Handles PSV evidence gathering (NCQA/JC compliance, API calls, manual review coordination)
- **Issuer Agent**: OIDC4VCI credential issuance, status lists, revocation
- **Auto-Tagger**: Classifies incoming events (e.g., license renewal → trigger PSV)

## Sequence Flow

```
┌─────────┐       ┌──────────────┐       ┌─────────────┐
│ Event   │──────>│ Orchestrator │──────>│ Agent Pool  │
│ (e.g.,  │       │ (classify &  │       │ (parallel   │
│ license │       │  route)      │       │  execution) │
│ expiry) │       └──────────────┘       └─────────────┘
└─────────┘              │                      │
                         │                      │
                         v                      v
                  ┌─────────────┐       ┌─────────────┐
                  │ Reconcile   │<──────│ Results     │
                  │ & Persist   │       │ (PSV done,  │
                  └─────────────┘       │ VC issued)  │
                                        └─────────────┘
```

## Health Monitoring

- **GET /api/agents/health**: Returns status of all agents
- Each agent reports readiness independently
- Orchestrator coordinates failover if an agent is down

## References

- PSYPACT & Counseling Compact: `/api/behavioral/eligibility`
- NCQA PSV Events: `/api/verify/events`
- Joint Commission Export: `/api/audit/survey-export`
- EUDI Profiles: `/api/eudi/issuer/profiles`

