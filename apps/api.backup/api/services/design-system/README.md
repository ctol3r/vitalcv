# Design System Documentation

This directory contains the design system documentation, components, and tooling for the Chai VC Platform.

## Structure

```
services/design-system/
├── docs/
│   ├── componentUsage.md          # Component usage guidelines
│   ├── accessibilityGuidelines.md # Accessibility best practices
│   └── contributionWorkflow.md   # Contribution process
├── icons/
│   └── iconLibrary.ts             # Icon library integration
├── theme/
│   └── themeTypes.ts              # Theme type definitions
├── release/
│   └── versioningPipeline.ts      # Automated versioning
└── analytics/
    └── adoptionAnalyticsService.ts # Component usage analytics
```

## Documentation Site

The design system documentation site is available at `/design-system/docs` in the web app.

### Features

- **Design Principles**: Core principles and guidelines
- **Design Tokens**: Colors, typography, spacing
- **Component Usage**: Guidelines for each component
- **Accessibility**: WCAG 2.1 AA compliance guidelines
- **Live Examples**: Storybook integration
- **Dark/Light Mode**: Theme toggle support

## Component Playground

Interactive playground at `/design-system/playground` for:

- Live component editing
- Prop customization
- Code snippet generation
- Theme toggling

## Components

### Page Layouts

Located in `apps/web/src/components/design/PageLayouts.tsx`:

- `OneColumnLayout` - Centered content layout
- `TwoColumnLayout` - Main content with sidebar
- `SidebarLayout` - Persistent sidebar layout
- `GridLayout` - Responsive grid system
- `DashboardLayout` - Full dashboard layout

### UX Patterns

Located in `apps/web/src/components/design/patterns/index.tsx`:

- `MultiStepForm` - Multi-step form wizard
- `WizardNavigation` - Step-by-step navigation
- `Pagination` - Page navigation component
- `SearchBar` - Debounced search input
- `Breadcrumbs` - Navigation breadcrumbs
- `TabNavigation` - Tab-based navigation

## Icon Library

The icon library (`icons/iconLibrary.ts`) provides:

- Consistent icon sizing (xs, sm, md, lg, xl, 2xl)
- Color tokens integration
- Pre-configured common icons
- Lucide React integration

### Usage

```tsx
import { Icon, Icons } from '@/services/design-system/icons/iconLibrary'

// Basic usage
<Icon name="User" size="md" color="primary" />

// Pre-configured icons
<Icons.CheckCircle size="lg" color="success" />
```

## Versioning Pipeline

The versioning pipeline (`release/versioningPipeline.ts`) automates:

- Version bumping (semver)
- Changelog generation
- Breaking change detection
- Release note creation

### Usage

```typescript
import { runVersioningPipeline } from './release/versioningPipeline'

runVersioningPipeline({
  packagePath: '.',
  changelogPath: './CHANGELOG.md',
  dryRun: false,
})
```

## Adoption Analytics

The analytics service (`analytics/adoptionAnalyticsService.ts`) tracks:

- Component usage across apps
- Adoption rates
- Most/least used components
- Usage by application

### Usage

```typescript
import { generateAdoptionReport } from './analytics/adoptionAnalyticsService'

const report = generateAdoptionReport(
  rootDir,
  componentsDir,
  componentPaths,
  apps
)
```

## Contributing

See `docs/contributionWorkflow.md` for:

- Design review process
- Coding standards
- Accessibility checklist
- Component development guidelines
- Pull request process

## Resources

- [Component Usage Guidelines](./docs/componentUsage.md)
- [Accessibility Guidelines](./docs/accessibilityGuidelines.md)
- [Contribution Workflow](./docs/contributionWorkflow.md)
- [Theme Types](./theme/themeTypes.ts)
