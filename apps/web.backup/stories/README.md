# VitalCV UI Components Storybook

This directory contains Storybook stories for all shared UI components in the VitalCV frontend application.

## Components Covered

### 1. CredentialStatusCard
- **Purpose**: Displays credential verification status with visual indicators
- **Variants**: Valid, Revoked, Unknown
- **Features**: QR code generation, share links, audit references
- **Design Tokens**: Uses status-specific colors (green for valid, red for revoked, gray for unknown)

### 2. UploadDropzone
- **Purpose**: File upload with drag-and-drop functionality
- **Features**: Progress tracking, file type validation, size limits, preview generation
- **Supported Types**: PDF, DOC, DOCX by default
- **Accessibility**: Full keyboard navigation and screen reader support

### 3. Field Components
- **Purpose**: Consistent form field wrapper with label, error, and description support
- **Components**: `Field` (base), `InputField`, `TextareaField`
- **Features**: Required indicators, error styling, accessibility attributes
- **Design**: Follows VitalCV's minimalist form design patterns

### 4. Toast Notifications
- **Purpose**: User feedback for actions and system messages
- **Variants**: Default, Success, Destructive
- **Features**: Auto-dismiss, manual close, action buttons
- **Design**: Slim, low-motion design as specified

### 5. Skeleton Loaders
- **Purpose**: Loading states for various content types
- **Components**: `Skeleton` (base), `SkeletonCard`, `SkeletonList`, `SkeletonTable`
- **Features**: Animated pulse effect, flexible sizing
- **Usage**: Blocks and lines for different content structures

## Running Storybook

\`\`\`bash
npm run storybook
\`\`\`

## Building Storybook

\`\`\`bash
npm run build-storybook
\`\`\`

## Design System Integration

All components follow VitalCV's design system:
- **Colors**: Uses CSS custom properties for theming
- **Typography**: Geist font family with consistent sizing
- **Spacing**: Tailwind spacing scale
- **Animations**: Minimal, purposeful motion
- **Accessibility**: WCAG 2.1 AA compliance

## Testing

Each component has comprehensive unit tests covering:
- Rendering with different props
- User interactions
- Error states
- Accessibility attributes
- Edge cases

Run tests with:
\`\`\`bash
npm test
