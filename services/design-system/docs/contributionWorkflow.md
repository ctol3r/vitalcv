# Contribution Workflow for Design System

This document describes how contributors can propose changes or new components to the design system, including the design review process, coding standards, accessibility checklist, and versioning practices.

## Table of Contents

- [Getting Started](#getting-started)
- [Design Review Process](#design-review-process)
- [Coding Standards](#coding-standards)
- [Accessibility Checklist](#accessibility-checklist)
- [Component Development](#component-development)
- [Versioning Practices](#versioning-practices)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Git
- Basic understanding of React and TypeScript
- Familiarity with design system principles

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-org/chai-vc-platform.git
   cd chai-vc-platform
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a branch for your changes:
   ```bash
   git checkout -b feature/your-component-name
   ```

---

## Design Review Process

### Before You Start Coding

1. **Check Existing Components**
   - Review existing components to avoid duplication
   - Check if your use case can be solved with existing components

2. **Propose Your Design**
   - Create a design proposal in an issue
   - Include:
     - Use case and problem statement
     - Visual mockups or wireframes
     - Component API proposal
     - Accessibility considerations
     - Examples of usage

3. **Get Design Approval**
   - Wait for design team review
   - Address feedback before implementation
   - Get approval from at least one design system maintainer

### Design Principles

All components must follow these principles:

- **Accessibility First**: Meet WCAG 2.1 AA standards
- **Consistency**: Follow existing patterns and conventions
- **Performance**: Optimize for bundle size and rendering
- **Developer Experience**: Clear API, good TypeScript types, comprehensive docs

---

## Coding Standards

### TypeScript

- Use TypeScript for all new components
- Provide proper type definitions
- Use interfaces for component props
- Avoid `any` types

```tsx
// Good
interface ButtonProps {
  variant: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

// Bad
function Button(props: any) {
  // ...
}
```

### Component Structure

```tsx
/**
 * Component description
 *
 * @example
 * <Component prop="value" />
 */
export function Component({ prop, ...rest }: ComponentProps) {
  // Implementation
}

export type { ComponentProps }
```

### File Naming

- Use PascalCase for component files: `Button.tsx`
- Use kebab-case for utilities: `format-date.ts`
- Use descriptive names: `UserProfileCard.tsx` not `Card.tsx`

### Code Style

- Follow existing code style
- Use Prettier for formatting
- Use ESLint for linting
- Maximum line length: 100 characters
- Use meaningful variable names

### Imports

```tsx
// External dependencies first
import React from 'react'
import { clsx } from 'clsx'

// Internal components
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// Utilities
import { cn } from '@/lib/utils'

// Types
import type { ComponentProps } from './types'
```

---

## Accessibility Checklist

Every component must pass this checklist:

### Keyboard Navigation

- [ ] All interactive elements are keyboard accessible
- [ ] Tab order is logical
- [ ] Focus indicators are visible
- [ ] Escape key closes modals/dialogs
- [ ] Arrow keys work for navigation (tabs, menus, etc.)

### Screen Reader Support

- [ ] All images have alt text
- [ ] Form inputs have labels
- [ ] ARIA attributes are used correctly
- [ ] Semantic HTML is used appropriately
- [ ] Dynamic content is announced

### Visual Design

- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Information is not conveyed by color alone
- [ ] Focus indicators are clearly visible
- [ ] Text is readable at all sizes

### Testing

- [ ] Tested with keyboard only
- [ ] Tested with screen reader (NVDA/JAWS/VoiceOver)
- [ ] Tested with browser zoom (200%)
- [ ] Tested in high contrast mode

---

## Component Development

### Component Template

```tsx
'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const componentVariants = cva(
  'base-classes',
  {
    variants: {
      variant: {
        default: 'default-classes',
        secondary: 'secondary-classes',
      },
      size: {
        sm: 'small-classes',
        md: 'medium-classes',
        lg: 'large-classes',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface ComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof componentVariants> {
  // Component-specific props
}

export function Component({
  className,
  variant,
  size,
  ...props
}: ComponentProps) {
  return (
    <div
      className={cn(componentVariants({ variant, size, className }))}
      {...props}
    />
  )
}
```

### Component Requirements

1. **Props Interface**
   - Well-typed with TypeScript
   - Clear documentation
   - Sensible defaults

2. **Variants**
   - Use `class-variance-authority` for variants
   - Follow existing variant patterns
   - Document all variants

3. **Accessibility**
   - Proper ARIA attributes
   - Keyboard support
   - Screen reader support

4. **Styling**
   - Use design tokens
   - Support dark mode
   - Responsive design

5. **Documentation**
   - JSDoc comments
   - Usage examples
   - Props table

### Storybook Stories

Create Storybook stories for all components:

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Component } from './Component'

const meta: Meta<typeof Component> = {
  title: 'Components/Component',
  component: Component,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Component>

export const Default: Story = {
  args: {
    variant: 'default',
    size: 'md',
  },
}
```

---

## Versioning Practices

### Semantic Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new Button component
fix: correct focus ring styling
docs: update component usage guidelines
refactor: simplify component logic
chore: update dependencies
```

### Breaking Changes

When making breaking changes:

1. Document in PR description
2. Add migration guide
3. Update CHANGELOG.md
4. Bump major version

---

## Pull Request Process

### Before Submitting

1. **Update Documentation**
   - Update component usage guidelines
   - Add Storybook stories
   - Update accessibility guidelines if needed

2. **Run Tests**
   ```bash
   npm run test
   npm run lint
   npm run type-check
   ```

3. **Check Accessibility**
   ```bash
   npm run test:a11y
   ```

4. **Build Storybook**
   ```bash
   npm run build-storybook
   ```

### PR Checklist

- [ ] Code follows coding standards
- [ ] TypeScript types are correct
- [ ] Component is accessible
- [ ] Documentation is updated
- [ ] Storybook stories are added
- [ ] Tests pass
- [ ] No linter errors
- [ ] Design review approved
- [ ] Breaking changes documented

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] New component
- [ ] Component update
- [ ] Bug fix
- [ ] Documentation
- [ ] Breaking change

## Accessibility
- [ ] Keyboard navigation tested
- [ ] Screen reader tested
- [ ] Color contrast verified
- [ ] Focus indicators visible

## Testing
- [ ] Unit tests added/updated
- [ ] Storybook stories added
- [ ] Manual testing completed

## Screenshots
(if applicable)

## Breaking Changes
(if applicable)
```

### Review Process

1. **Automated Checks**
   - CI/CD runs tests and linting
   - Accessibility checks run
   - Build verification

2. **Code Review**
   - At least one maintainer approval required
   - Address all review comments
   - Update PR based on feedback

3. **Design Review**
   - Design team reviews visual changes
   - Accessibility team reviews a11y changes

4. **Merge**
   - Squash and merge preferred
   - Delete branch after merge

---

## Release Process

### Version Bump

The versioning pipeline automatically:
- Detects breaking changes
- Bumps version (semver)
- Generates changelog
- Updates package.json

### Release Checklist

- [ ] All tests pass
- [ ] Documentation is complete
- [ ] Changelog is updated
- [ ] Version is bumped
- [ ] Release notes are written
- [ ] Tag is created
- [ ] Package is published (if applicable)

### Release Notes

Include in release notes:
- New components
- Component updates
- Breaking changes
- Bug fixes
- Documentation updates

---

## Resources

### Documentation

- [Component Usage Guidelines](./componentUsage.md)
- [Accessibility Guidelines](./accessibilityGuidelines.md)
- [Design Tokens](../theme/themeTypes.ts)

### Tools

- [Storybook](https://storybook.js.org/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

### Getting Help

- Open an issue for questions
- Join design system discussions
- Contact design system maintainers

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-16 | Initial contribution workflow |

