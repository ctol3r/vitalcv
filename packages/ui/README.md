# @vitalcv/ui

Shared UI components package for VitalCV monorepo.

## Purpose

This package contains reusable React components that can be used across:
- Frontend web app (`@vitalcv/web`)
- Admin panels
- Future mobile apps
- Documentation sites

## Usage

```typescript
import { Button, Card } from '@vitalcv/ui';
```

## Development

### Adding Components

1. Create component in `src/components/`
2. Export from `src/index.ts`
3. Update this README with component documentation

### Building

```bash
pnpm build
```

### Type Checking

```bash
pnpm typecheck
```

## Component Guidelines

- Use TypeScript for all components
- Export prop types
- Include JSDoc comments
- Follow React best practices
- Ensure accessibility (a11y)
- Support dark mode if applicable

## Status

**Status**: Initial setup complete
**Components**: 0 (ready for extraction)
**Next Steps**: Extract shared components from `apps/web/components/`

