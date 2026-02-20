# VitalCV — Architecture Overview

## System diagram

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Browser    │────▶│  Marketing Site   │────▶│    API Server     │
│  (React 19)  │     │  (Next.js 15)    │     │  (Express.js)    │
│              │     │  Vercel          │     │  Railway         │
└─────────────┘     └──────────────────┘     └────────┬─────────┘
                                                       │
                              ┌─────────────────────────┼──────────────────────┐
                              │                         │                      │
                    ┌─────────▼─────────┐   ┌──────────▼──────────┐  ┌────────▼────────┐
                    │  Identity Module   │   │   Trust Engine       │  │  Storage         │
                    │                    │   │                      │  │                  │
                    │  • NPPES lookup    │   │  • Rule evaluation   │  │  • PostgreSQL    │
                    │  • Normalize       │   │  • Trust flags       │  │    (migrating)   │
                    │  • Artifact gen    │   │  • Revocation        │  │  • Transparency  │
                    │  • ES256 signing   │   │  • Drift detection   │  │    log           │
                    └─────────┬─────────┘   └──────────────────────┘  └──────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   CMS NPPES API    │
                    │   (Federal)        │
                    │   v2.1             │
                    └───────────────────┘
```

## Component descriptions

### Marketing Site (Next.js 15)
- **Host**: Vercel
- **Purpose**: Public-facing pages, interactive demo wizard, API proxy
- **Key routes**: `/demo` (interactive wizard), `/security`, `/progress`, `/contact`
- **Proxy**: `/api/demo/*` forwards to API server to avoid CORS

### API Server (Express.js)
- **Host**: Railway
- **Purpose**: Identity pipeline, trust engine, credential management
- **Demo routes**: `/demo/provider`, `/demo/verify`, `/demo/sample-npis` (rate-limited, no auth)
- **Production routes**: `/api/npi/*`, `/api/artifact/*`, `/trust-state/*` (API key + tenant context)

### Identity Module
The core pipeline that transforms raw NPPES data into signed credentials:

1. **fetchNpiFromCMS** — Calls `npiregistry.cms.hhs.gov/api/?version=2.1&number={npi}`
2. **normalizeProvider** — Extracts NPI, name, taxonomy, status, enumeration type
3. **generateIdentityArtifact** — Creates deterministic artifact with schema version, SHA-256 payload hash, Merkle root
4. **signArtifact** — Signs with ES256 (P-256), outputs JWS compact serialization with `kid` versioning

### Trust Engine
Rule-based credential status evaluation:
- Trust flags emitted per credential lifecycle event
- Revocation support with reason codes
- Drift detection (monitors for changes in source data)

### Storage
- Currently: SQLite + in-memory stores (migration in progress)
- Target: PostgreSQL via Prisma ORM
- Append-only transparency log for all issued artifacts

## Key standards

| Standard | Role |
|----------|------|
| OpenID4VCI | Credential issuance (Pre-Authorized Code flow) |
| OpenID4VP | Credential presentation (same-device + cross-device) |
| HAIP 1.0 | Health Authority Interoperability Profile |
| W3C VC Data Model | Credential format and semantics |
| ES256 (P-256) | Signing algorithm |
| DPoP | Token binding (proof of possession) |
| PKCE S256 | OAuth code exchange protection |

## Monorepo structure

```
vitalcv/
├── apps/
│   ├── api/backend/     # Express.js API server
│   ├── marketing/       # Next.js 15 public site
│   └── web/             # Next.js 15 web app (clinician/verifier)
├── packages/
│   ├── domain-common/   # Shared domain types
│   ├── domain/          # Domain logic
│   ├── domain-authority/ # Authority/DID logic
│   ├── shared/          # Shared utilities + credential helpers
│   └── ingest/          # Data ingestion pipeline
├── docs/
│   └── yc/              # YC-facing documentation
└── scripts/
    └── yc/              # Deployment scripts
```

## Infrastructure

| Service | Provider | Purpose |
|---------|----------|---------|
| API | Railway | Express.js server, auto-deploy on push |
| Marketing | Vercel | Next.js 15 marketing site |
| Web app | Vercel | Next.js 15 clinician/verifier app |
| Database | Railway PostgreSQL | Prisma ORM (migrating from SQLite) |
| DNS | Vercel | Custom domains |
| CI | GitHub Actions | Build, typecheck, deploy |
