# VitalCV — One-Pager

## What VitalCV does

VitalCV is a healthcare credentialing platform that turns messy provider data into cryptographically signed, machine-verifiable identity artifacts. We pull from authoritative sources (CMS NPPES), normalize the data, and issue W3C-compatible verifiable credentials using OpenID4VCI — making provider verification instant instead of weeks.

## What's live right now

| Surface | URL | What it does |
|---------|-----|--------------|
| Marketing site | `https://vitalcv.com` | Public landing, security model, progress log |
| Interactive demo | `https://vitalcv.com/demo` | 3-step wizard: NPI lookup → provider card → signed artifact |
| API health | `https://api.vitalcv.com/demo/status` | Live status, version, uptime |
| Security posture | `https://api.vitalcv.com/api/security/posture` | Enforcement toggles |

### Demo flow (30 seconds)

1. Enter any 10-digit NPI (or click a sample)
2. See the provider's NPPES data normalized in real time
3. Generate a signed identity credential with ES256, SHA-256 hash chain, and full artifact JSON

## Technical stack

- **Identity pipeline**: CMS NPPES → normalize → deterministic artifact → ES256 signing → JWS compact serialization
- **Standards**: OpenID4VCI (issuance), OpenID4VP (presentation), HAIP 1.0, W3C Verifiable Credentials
- **Crypto**: ES256 (P-256), PKCE S256, DPoP token binding, SHA-256 Merkle roots
- **Infra**: Node.js + Express (Railway), Next.js 15 (Vercel), PostgreSQL (migrating), pnpm monorepo + Turborepo

## What's next (2 weeks)

- PostgreSQL migration (everything is SQLite + in-memory today)
- API security hardening (CORS, helmet, API key rotation)
- Authentication for verifier dashboard (Clerk or NextAuth)
- Primary source verification (automated board license checks)

## Team

Solo founder, technical. Building the full stack — crypto, standards compliance, infrastructure, and product.

## Contact

hello@vitalcv.com
