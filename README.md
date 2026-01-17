# VitalCV Monorepo

<!-- VitalCV canonical monorepo (source of truth). -->

> **VitalCV canonical monorepo.** Open this repository at the monorepo root (`/vitalcv`). Legacy repos are reference-only and must not be used as working directories.

Unified monorepo for the VitalCV healthcare credentialing platform.

## Canonical Repository Declaration

This repository (`ctol3r/vitalcv`) is the **single canonical** repository for the VitalCV platform.

- **All active development**: must occur in this repository.
- **Legacy repositories (reference-only)**: see `./.ai/snapshot.md` (legacy identifiers are intentionally centralized there and should be purged elsewhere).
- **Operational snapshot**: `./.ai/snapshot.md` is authoritative for “as-is” boundaries and constraints.
- **Runtime rule**: if something is not present in this repo, it is not part of the current system.

## Canonical Rules

- Agent safety rules: `AGENTS.md`
- System boundaries: `docs/architecture.md`
- Legacy history: `docs/legacy-context.md`

## Structure

```text
vitalcv/
├── apps/
│   ├── api/          # Backend API
│   └── web/          # Frontend Next.js app
├── packages/         # Shared packages
├── blockchain/       # Blockchain/Substrate integration
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
pnpm --filter @vitalcv/api dev
pnpm --filter @vitalcv/web dev
```

### Building

```bash
# Build all packages and apps
pnpm build

# Build specific package/app
pnpm --filter @vitalcv/api build
pnpm --filter @vitalcv/web build
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package/app
pnpm --filter @vitalcv/api test
```

## Key Workspaces

- `apps/api` - Backend API surface
- `apps/web` - Frontend Next.js application
- `packages/shared-utils` - Shared utilities
- `packages/vc-schemas` - Verifiable Credential schemas
- `packages/vc-formats-csdjwt` - CSD-JWT VC format helpers
- `packages/domain-identity` - Identity domain types/logic
- `packages/logging-core` - Logging core
- `packages/ui` - Shared UI components

For a full list, see `apps/`, `packages/`, and `services/`.

## Contributing

See `docs/architecture.md` for system boundaries and `AGENTS.md` for repo rules.

## License

Proprietary - All rights reserved
