# VitalCV Monorepo

Unified monorepo for the VitalCV healthcare credentialing platform.

## Structure

```
vitalcv/
├── apps/
│   ├── api/          # Backend API (from chai-vc-platform)
│   └── web/          # Frontend Next.js app (from v0-vital-cv-frontend-mvp)
├── packages/         # Shared packages
├── blockchain/       # Blockchain/Substrate integration
├── docs/            # Documentation
└── infra/           # Infrastructure as code
```

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

