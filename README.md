# VitalCV Monorepo

<!-- VitalCV canonical monorepo (source of truth). -->

> **VitalCV canonical monorepo.** Open this repository at the monorepo root (`/vitalcv`). Any legacy `v0-*` repos are archival and should not be used as the working directory.

Unified monorepo for the VitalCV healthcare credentialing platform.

## Antigravity Contract

This system operates under strict **Antigravity** requirements (see [`ANTIGRAVITY.md`](./ANTIGRAVITY.md)).

**The Canonical Action:**
> A clinician presents verified authority → An employer accepts it → Progress continues without re-verification.

**Forbidden Patterns:**
- No "Committee Packets" or manual upload workflows.
- No "Dashboards" that exist outside of blocking moments.
- No parallel verify flows (e.g. manual profile claims).

## Structure

```text
vitalcv/
├── apps/
│   ├── api/          # Backend API (NPI sync, Issuer logic)
│   ├── web/          # Frontend Next.js app (Antigravity-compliant UI)
│   └── verifier-api/ # OID4VP Verifier (Canonical Path enforcement)
├── packages/         # Shared packages (Contracts, Guards, Policy)
├── blockchain/       # Blockchain integration
├── docs/            # Documentation
└── infra/           # Infrastructure as code
```

## Workspace

- Open the repo at the root (recommended: open `vitalcv.code-workspace` in Cursor).

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+

### Installation

```bash
pnpm install
```

### Development

```bash
# Run all apps in development mode
pnpm dev

# Run specific app
pnpm --filter @vitalcv/web dev
```

### Building

```bash
# Build all packages and apps
pnpm build
```

## Workspace Packages

- `@vitalcv/web` - Frontend Next.js application
- `@vitalcv/api` - Main backend API
- `@vitalcv/verifier-api` - OIDC4VP Verifier Service
- `@domain-common/psvContracts` - Shared type definitions for PSV
- `@domain-common/employmentGuards` - Canonical Path logic

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.
Refer to `TECH_DEBT.md` for current limitations and roadmap.

## License

Proprietary - All rights reserved
