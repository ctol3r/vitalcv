# Contributing to VitalCV

Thank you for your interest in contributing to VitalCV! This guide will help you get started with development.

## Table of Contents

- [Technology Stack](#technology-stack)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Storybook](#storybook)

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS 3.x
- **UI Components**: shadcn/ui (Radix UI primitives)
- **State Management**: React hooks, Context API
- **Testing**: Jest, React Testing Library
- **Component Dev**: Storybook 7.x

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Next.js API Routes
- **Authentication**: DID-based, OIDC4VCI
- **Cache/Storage**: Redis 7+ (optional)
- **Logging**: Structured JSON (Winston-compatible)

### Standards & Protocols
- **OIDC4VCI**: OpenID for Verifiable Credential Issuance
- **SD-JWT**: Selective Disclosure JSON Web Tokens
- **BBS+**: BBS+ signatures for selective disclosure
- **DCQL**: Digital Credentials Query Language
- **DID**: Decentralized Identifiers (did:key)

## Development Setup

### Prerequisites

- Node.js 20+ and npm 9+
- Docker 24+ and Docker Compose 2+ (optional, for Redis)
- Git

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/your-org/vitalcv.git
cd vitalcv

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Generate cryptographic keys
node -e "
const crypto = require('crypto');
const {privateKey, publicKey} = crypto.generateKeyPairSync('ec', {namedCurve: 'P-256'});
console.log('ISSUER_PRIVATE_KEY=' + Buffer.from(privateKey.export({type:'pkcs8',format:'pem'})).toString('base64'));
console.log('ISSUER_PUBLIC_KEY=' + Buffer.from(publicKey.export({type:'spki',format:'pem'})).toString('base64'));
"

# Add the generated keys to .env.local
# Edit .env.local with your editor
```

### Environment Variables

Required for development:

```env
# Application
NODE_ENV=development
NEXT_PUBLIC_ISSUER_URL=http://localhost:3000

# Redis (optional for development)
ENABLE_REDIS=false
REDIS_URL=redis://localhost:6379

# Cryptographic Keys (generated above)
ISSUER_PRIVATE_KEY=<base64-encoded-pem>
ISSUER_PUBLIC_KEY=<base64-encoded-pem>

# Logging
LOG_LEVEL=debug

# Feature Flags
ENABLE_STATUS_LIST=false
```

### Start Development Server

```bash
# Start Next.js dev server
npm run dev

# Open http://localhost:3000
```

### Start with Redis (Optional)

```bash
# Start Redis via Docker Compose
docker-compose up -d redis

# Enable Redis in .env.local
ENABLE_REDIS=true

# Restart dev server
npm run dev
```

## Project Structure

```
vitalcv/
├── app/                          # Next.js App Router pages
│   ├── api/                      # API routes
│   │   ├── oidc4vci/             # OIDC4VCI endpoints (offer, token, credential)
│   │   ├── verifier/             # Verification endpoints
│   │   ├── auth/                 # Authentication (DID-based)
│   │   ├── health/               # Health check endpoints
│   │   └── .well-known/          # Discovery endpoints (JWKS, issuer metadata)
│   ├── verify/                   # Verification UI page
│   ├── issuer/                   # Issuer pages
│   ├── api-docs/                 # API documentation page
│   ├── health/                   # System health UI
│   └── layout.tsx                # Root layout
├── components/                   # React components
│   ├── ui/                       # Base UI components (shadcn/ui)
│   ├── credentials/              # Credential-specific components (QR, Deep Link)
│   ├── verifier/                 # Verifier components (Result Card)
│   ├── wallet/                   # Wallet integration components
│   └── accessibility/            # Accessibility utilities (aria-live, skip-link)
├── lib/                          # Business logic & utilities
│   ├── oidc4vci/                 # OIDC4VCI implementation
│   ├── crypto/                   # Cryptographic operations (keys, JWT)
│   ├── verifier/                 # Verification logic (DCQL, nonce)
│   ├── logging/                  # Audit logging
│   ├── middleware/               # Rate limiting, CORS
│   ├── observability/            # Request ID utilities
│   └── wallet/                   # Wallet integration types
├── __tests__/                    # Test files
│   ├── e2e/                      # End-to-end integration tests
│   ├── lib/                      # Library unit tests
│   └── components/               # Component tests
├── .storybook/                   # Storybook configuration
├── stories/                      # Component stories
├── public/                       # Static assets
├── .github/                      # GitHub Actions workflows
│   └── workflows/                # CI/CD pipelines
├── Dockerfile                    # Production container
├── docker-compose.yml            # Local dev stack
├── lighthouserc.json             # Lighthouse CI config
├── DEPLOYMENT.md                 # Production deployment guide
├── INCIDENTS.md                  # Incident response guide
└── CONTRIBUTING.md               # This file
```

## Development Workflow

### Scripts

```bash
# Development
npm run dev                      # Start dev server with hot reload
npm run build                    # Build for production
npm run start                    # Start production server

# Testing
npm test                         # Run all tests
npm run test:watch               # Run tests in watch mode
npm run test:coverage            # Generate coverage report
npm run test:e2e                 # Run E2E tests only

# Code Quality
npm run lint                     # Run ESLint
npm run lint:fix                 # Fix ESLint errors
npm run typecheck                # Run TypeScript type checking
npm run format                   # Format code with Prettier
npm run format:check             # Check formatting

# Component Development
npm run storybook                # Start Storybook dev server
npm run build-storybook          # Build Storybook static site

# Docker
npm run docker:build             # Build Docker image
npm run docker:up                # Start all services
npm run docker:down              # Stop all services
npm run docker:logs              # View logs
```

### Feature Development

1. **Create a feature branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make changes**:
   - Write code following style guide
   - Add tests for new functionality
   - Update relevant documentation

3. **Test locally**:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```

4. **Commit changes**:
   ```bash
   git add .
   git commit -m "feat: add credential revocation support"
   ```

5. **Push and create PR**:
   ```bash
   git push origin feat/your-feature-name
   # Open PR on GitHub
   ```

## Testing

### Unit Tests

```bash
# Run specific test file
npm test -- lib/crypto/jwt.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="JWT signing"

# Generate coverage
npm run test:coverage
```

### E2E Integration Tests

```bash
# Run E2E tests
npm run test:e2e

# Run specific E2E test
npm test -- __tests__/e2e/oidc4vci-flow.test.ts
```

### Writing Tests

```typescript
// Example unit test
import { signJWT, verifyJWT } from '@/lib/crypto/jwt'

describe('JWT Operations', () => {
  it('should sign and verify JWT', async () => {
    const payload = { sub: 'user-123', aud: 'vitalcv' }
    const jwt = await signJWT(payload)
    const verified = await verifyJWT(jwt)

    expect(verified.sub).toBe('user-123')
  })
})
```

```typescript
// Example component test
import { render, screen } from '@testing-library/react'
import { QrBlock } from '@/components/credentials/QrBlock'

describe('QrBlock', () => {
  it('should render QR code with data', () => {
    render(<QrBlock data="test-data" />)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })
})
```

### Test Coverage Goals

- **Overall**: >= 80%
- **Critical paths** (auth, crypto, OIDC4VCI): >= 90%
- **UI components**: >= 70%

## Code Style

### TypeScript

- Use TypeScript strict mode
- Define explicit types for function parameters and returns
- Use interfaces for objects, types for unions
- Avoid `any` - use `unknown` if type is truly unknown

```typescript
// Good
interface CredentialOffer {
  credentialType: string
  issuerId: string
  preAuthCode: string
}

function createOffer(params: CredentialOffer): OfferResult {
  // ...
}

// Bad
function createOffer(params: any) {
  // ...
}
```

### React Components

- Use functional components with hooks
- Extract complex logic into custom hooks
- Use TypeScript for prop types

```typescript
// Good
interface ButtonProps {
  label: string
  onClick: () => void
  disabled?: boolean
}

export function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  )
}
```

### Accessibility

- Use semantic HTML elements
- Add ARIA labels for screen readers
- Ensure keyboard navigation works
- Test with screen readers

```tsx
// Good
<button aria-label="Copy offer URL" onClick={handleCopy}>
  <Copy className="h-4 w-4" aria-hidden="true" />
  Copy
</button>
```

### Naming Conventions

- **Components**: PascalCase (`CredentialCard`, `QrBlock`)
- **Functions**: camelCase (`generateOffer`, `verifyCredential`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`, `DEFAULT_TTL`)
- **Files**: kebab-case (`credential-card.tsx`, `jwt-utils.ts`)

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, no logic change)
- **refactor**: Code refactoring (no feature change)
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Build process or auxiliary tool changes

### Examples

```bash
feat(oidc4vci): add PKCE support to token endpoint

Implements PKCE (Proof Key for Code Exchange) following RFC 7636.
Adds code_challenge and code_verifier validation to token endpoint.

Closes #123

---

fix(verifier): handle expired credentials gracefully

Previously threw unhandled exception when verifying expired credentials.
Now returns proper error response with 400 status.

---

docs(deployment): add Kubernetes deployment guide

Adds complete guide for deploying to Kubernetes with Helm charts.
Includes configuration for horizontal pod autoscaling.
```

## Pull Request Process

### Before Submitting

1. **Update your branch**:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Run all checks**:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

3. **Update documentation**:
   - Update README if adding features
   - Add JSDoc comments to public APIs
   - Update CHANGELOG.md

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guide
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Lighthouse CI passes (performance >= 90)

## Screenshots (if applicable)
```

### Review Process

1. Automated checks must pass (CI/CD)
2. At least one approval required
3. All conversations must be resolved
4. Branch must be up-to-date with main

## Storybook

### Running Storybook

```bash
npm run storybook
# Open http://localhost:6006
```

### Writing Stories

```tsx
// stories/QrBlock.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { QrBlock } from '@/components/credentials/QrBlock'

const meta: Meta<typeof QrBlock> = {
  title: 'Credentials/QrBlock',
  component: QrBlock,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof QrBlock>

export const Default: Story = {
  args: {
    data: 'openid-credential-offer://...',
    title: 'Scan to Accept',
  },
}

export const Loading: Story = {
  args: {
    data: '',
    loading: true,
  },
}
```

## Questions?

- **Documentation**: See README.md, DEPLOYMENT.md, INCIDENTS.md
- **Issues**: https://github.com/your-org/vitalcv/issues
- **Discussions**: https://github.com/your-org/vitalcv/discussions
- **Email**: dev@vitalcv.com

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
