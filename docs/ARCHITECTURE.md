# VitalCV Architecture

## System Overview

VitalCV is a cryptographic trust infrastructure platform for healthcare credentialing. It enables primary source verification, credential issuance (W3C VCs / SD-JWT), and trust graph operations — replacing a 30-day manual process with 24-hour automated verification.

```
┌─────────────────────────────────────────────────────────┐
│                    apps/web (Next.js 15)                 │
│  Homepage · Holder · Verifier · CommandCenter · Demo     │
│  Analytics · Billing · Investors · Partners · Developers │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP / REST
┌──────────────────────▼──────────────────────────────────┐
│              apps/api/backend (Express + Prisma)         │
│                                                          │
│  ┌────────────────┐  ┌─────────────────┐                │
│  │  Credential    │  │   Trust Registry │                │
│  │  Layer         │  │   + DID Layer    │                │
│  │  Issue/Verify  │  │   trustRegistry  │                │
│  │  W3C VC/SD-JWT │  │   didRegistry    │                │
│  └────────────────┘  └─────────────────┘                │
│                                                          │
│  ┌────────────────┐  ┌─────────────────┐                │
│  │  OID4VCI/VP    │  │   Federation     │                │
│  │  issuanceServer│  │   networkMap     │                │
│  │  presentServer │  │   globalGraph    │                │
│  └────────────────┘  └─────────────────┘                │
│                                                          │
│  ┌────────────────┐  ┌─────────────────┐                │
│  │  Analytics     │  │   Billing        │                │
│  │  analyticsEng  │  │   subscriptions  │                │
│  │                │  │   apiKeyService  │                │
│  └────────────────┘  └─────────────────┘                │
└──────────────────────┬──────────────────────────────────┘
                       │ Prisma ORM
┌──────────────────────▼──────────────────────────────────┐
│              PostgreSQL (production) / SQLite (dev)      │
└─────────────────────────────────────────────────────────┘
```

## Monorepo Structure

```
vitalcv/
├── apps/
│   ├── web/                  Next.js 15 frontend
│   │   ├── app/              App Router pages
│   │   ├── components/       React components
│   │   └── hooks/            Custom hooks
│   └── api/
│       └── backend/          Express API
│           ├── src/
│           │   ├── routes/   Route handlers
│           │   ├── services/ Business logic
│           │   ├── middleware/ Middleware
│           │   ├── obs/      Observability (logger)
│           │   └── app.ts    Express app entry
│           └── prisma/       Database schema + migrations
├── packages/
│   ├── embed-sdk/            VitalCV.mount() widget SDK
│   └── command-registry/     Command center registry
├── .github/workflows/        CI/CD (build, lint, typecheck)
└── docs/                     Architecture & API docs
```

## Service Inventory (Backend)

### Credential Layer
| Service | Description |
|---------|-------------|
| `credentialModel` | W3C VC creation with Prisma persistence |
| `credentialIssuer` | ES256 JWS signing via `jose` |
| `credentialVerifier` | Signature + expiry + revocation check |
| `credentialWallet` | Per-clinician wallet with expiry warnings |
| `credentialPresentation` | VP bundle creation |
| `selectiveDisclosure` | Salted SHA-256 SD-JWT selective claims |
| `sdJwtCredential` | Full SD-JWT implementation |

### Trust Registry & Identity
| Service | Description |
|---------|-------------|
| `trustRegistry` | Seeded issuers (CA Medical Board, ABIM, NPI, DEA) |
| `reputationEngine` | 0–100 trust score computation |
| `didRegistry` | DID register/resolve/rotate |
| `didResolver` | 5-min cache, supports did:vitalcv |

### Interoperability
| Service | Description |
|---------|-------------|
| `issuanceServer` | OID4VCI credential issuance (jwt_vc_json, vc+sd-jwt) |
| `presentationServer` | OID4VP presentation requests/responses |
| `federationMetadata` | OpenID Federation entity statements |
| `haipProfile` | HAIP trust policy for high-assurance credentials |
| `conformanceSuite` | Full W3C VC + OID4VCI/VP conformance tests |

### Network & Federation
| Service | Description |
|---------|-------------|
| `globalGraph` | Aggregated trust network graph |
| `networkMap` | Node/edge management |
| `federation` | External network registration (Nursys, CAQH) |
| `webhookDispatcher` | Event delivery to registered endpoints |

### Analytics & Billing
| Service | Description |
|---------|-------------|
| `analyticsEngine` | KPI aggregation (issuances, verifiers, network) |
| `subscriptionService` | Tier management (Starter/Growth/Enterprise) |
| `apiKeyService` | SubscriptionApiKey CRUD + SHA-256 hashing |
| `usageMeter` | Per-key request counting and limit enforcement |

### Monitoring & Alerts
| Service | Description |
|---------|-------------|
| `trustAlerts` | Emit/acknowledge trust alerts |
| `alertEngine` | Alert routing and escalation |
| `revocationListener` | Cascade revocation events |
| `expirationScanner` | 120/60/30-day expiry warnings |

## API Route Map

```
/api/credentials/*         Credential issuance, verification, wallet, presentation
/api/registry/*            Trust registry CRUD
/api/did/*                 DID register, resolve, rotate
/api/revocation/*          Revoke, status check
/api/oid4vci/*             OID4VCI issuance + well-known metadata
/api/oid4vp/*              OID4VP presentation requests/responses
/api/federation/*          Network federation
/api/federation/metadata   OpenID Federation entity statement
/api/conformance/*         Conformance suite + audit receipts
/api/analytics/*           Platform KPIs and issuer stats
/api/subscriptions/*       Subscription tier management
/api/api-keys/*            API key generation and revocation
/api/feedback/*            NPS and feedback submission
/api/docs/*                OpenAPI spec + endpoint listing
/api/network/global        Global trust network graph
/api/alerts/*              Trust alerts
/api/governance/*          Trust governance rules
/api/issuer-onboarding/*   Issuer registration flow
```

## Data Flow: Credential Issuance

```
POST /api/credentials/issue
  → credentialModel.createCredential()
  → credentialIssuer.signCredential() [ES256 JWS via jose]
  → didRegistry.resolveDid() [embed DID metadata]
  → prisma.credential.create()
  → auditEvent.create({ type: 'CREDENTIAL_ISSUED' })
  → return { credentialJwt, credentialId }
```

## Data Flow: OID4VCI

```
POST /api/oid4vci/credential
  → validate format (jwt_vc_json | vc+sd-jwt)
  → issuanceServer.issueOID4VCICredential()
  → credentialIssuer.signCredential()
  → return { credential, format, c_nonce }
```

## Deployment Requirements

| Requirement | Value |
|-------------|-------|
| Node.js | ≥ 22 |
| pnpm | ≥ 10 |
| PostgreSQL | ≥ 14 |
| ENV: `DATABASE_URL` | PostgreSQL connection string |
| ENV: `CREDENTIAL_SIGNING_KEY_PEM` | ES256 private key PEM |
| ENV: `STRIPE_SECRET_KEY` | Stripe secret (billing optional) |
| ENV: `NEXT_PUBLIC_API_URL` | Backend URL for frontend |

## Security Notes

- No secrets hardcoded — all from environment variables
- API keys stored as SHA-256 hashes only
- Credentials signed with ES256 (asymmetric)
- Rate limiting: 50 req/hr (no key), 100–1000 req/hr (by tier)
- HIPAA compliance: PHI detection via `hipaaGuard.ts`, AES-256-GCM encryption
- All audit events persisted with `type`, `clinicianId`, `referenceId`
