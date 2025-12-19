# VitalCV Monorepo

<!-- VitalCV canonical monorepo (source of truth). -->

> **VitalCV canonical monorepo.** Open this repository at the monorepo root (`/vitalcv`). Any legacy `v0-*` repos are archival and should not be used as the working directory.

Unified monorepo for the VitalCV healthcare credentialing platform.

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

## Workspace Packages

- `@vitalcv/api` - Main backend API
- `@vitalcv/web` - Frontend Next.js application
- `@vitalcv/shared-utils` - Shared utilities
- `@vitalcv/vc-schemas` - Verifiable Credential schemas
- `@vitalcv/compliance-core` - Compliance and regulatory logic
- `@vitalcv/psv-pipeline` - Provider Screening and Verification pipeline
- `@vitalcv/ai-engines` - AI/ML engines
- `@vitalcv/ui` - Shared UI components

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

Proprietary - All rights reserved
