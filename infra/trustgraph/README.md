# TrustGraph Infrastructure

This directory holds the TrustGraph docker-compose stack configuration for VitalCV.

## Overview

[TrustGraph](https://github.com/ctol3r/trustgraph) is a graph-native evidence and semantic retrieval layer. In the VitalCV stack it serves as the authoritative store for:

- **VerificationArtifacts** — cryptographically anchored source evidence (NPPES, state boards, OIG)
- **Claims** — structured attestations derived from raw source data
- **Context Cores** — per-NPI semantic collections enabling cross-source reasoning

TrustGraph augments (but does not replace) our Prisma relational DB. Prisma owns user accounts and workflow state. TrustGraph owns the evidence graph.

## Setup

Generate the docker-compose stack config using the official TrustGraph config tool:

```bash
npx @trustgraph/config
```

Do **not** commit generated compose files containing secrets. Use `.env` and reference `TRUSTGRAPH_API_URL` / `TRUSTGRAPH_API_KEY` from Railway environment variables.

## Environment Variables

| Variable              | Description                            | Required |
|-----------------------|----------------------------------------|----------|
| `TRUSTGRAPH_API_URL`  | Base URL of the TrustGraph API service | Yes      |
| `TRUSTGRAPH_API_KEY`  | API key for authenticating requests    | Yes      |

## Integration Points

- **Backend:** `apps/api/src/services/TrustGraphService.ts` — evidence anchoring bridge
- **Frontend:** `apps/web/components/providers/TrustGraphProvider.tsx` — React context provider for graph queries

## Local Development

1. Run `npx @trustgraph/config` to generate the stack
2. Start with `docker compose up -d`
3. Set `TRUSTGRAPH_API_URL=http://localhost:8088` in your local `.env`
