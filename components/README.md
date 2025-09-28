# VitalCV UI Components

This directory contains all reusable UI components for the VitalCV frontend application, organized following atomic design principles and VitalCV's design system.

## Architecture

### Component Organization
\`\`\`
components/
├── ui/                    # Base UI components (shadcn/ui + custom)
│   ├── field.tsx         # Form field wrapper with validation
│   ├── upload-dropzone.tsx # File upload with drag-and-drop
│   ├── skeleton.tsx      # Loading state components
│   ├── toast.tsx         # Notification components
│   └── ...               # Other base components
├── CredentialStatusCard.tsx # Business logic components
└── README.md             # This file
\`\`\`

### Design System Integration

All components follow VitalCV's design principles:

#### Color System
- **Status Colors**: Green (valid), Red (revoked), Gray (unknown)
- **Semantic Tokens**: Uses CSS custom properties for consistent theming
- **Glassmorphism**: Subtle transparency and blur effects where appropriate

#### Typography
- **Font Family**: Geist (sans-serif) for clean, professional appearance
- **Scale**: Consistent sizing using Tailwind's type scale
- **Hierarchy**: Clear visual hierarchy with proper contrast ratios

#### Spacing & Layout
- **Grid System**: Responsive layouts using CSS Grid and Flexbox
- **Spacing Scale**: Tailwind's spacing scale for consistent margins/padding
- **Breakpoints**: Mobile-first responsive design

## Component Categories

### 1. Form Components
- **Field**: Base wrapper for form inputs with label, error, and description
- **InputField**: Text input with integrated field wrapper
- **TextareaField**: Multi-line text input with field wrapper

**Usage:**
\`\`\`tsx
<InputField
  label="Email"
  type="email"
  required
  error={errors.email?.message}
  placeholder="Enter your email"
/>
\`\`\`

### 2. Status & Feedback
- **CredentialStatusCard**: Displays credential verification results
- **Toast**: User notifications with success/error variants
- **Skeleton**: Loading states for different content types

**Usage:**
\`\`\`tsx
<CredentialStatusCard
  result={{
    status: "valid",
    credentialId: "CRED-12345",
    details: { issuer: "Medical Board" }
  }}
/>
\`\`\`

### 3. File Handling
- **UploadDropzone**: Drag-and-drop file upload with progress tracking
- Supports PDF, DOC, DOCX with configurable size limits
- Real-time upload progress and file management

**Usage:**
\`\`\`tsx
<UploadDropzone
  maxFiles={5}
  maxSize={10 * 1024 * 1024} // 10MB
  onFilesChange={(files) => setUploadedFiles(files)}
/>
\`\`\`

## Development Guidelines

### Component Creation
1. **Start with Storybook**: Create stories first to define component API
2. **Write Tests**: Unit tests for all user interactions and edge cases
3. **Follow Patterns**: Use existing components as templates
4. **Accessibility**: Ensure WCAG 2.1 AA compliance

### Props Interface
\`\`\`tsx
interface ComponentProps {
  // Required props first
  children: React.ReactNode
  
  // Optional props with defaults
  variant?: 'default' | 'success' | 'error'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  
  // Event handlers
  onClick?: () => void
  onSubmit?: (data: FormData) => void
  
  // Styling
  className?: string
}
\`\`\`

### Error Handling
- **Graceful Degradation**: Components work without JavaScript
- **Error Boundaries**: Catch and display component errors
- **Loading States**: Show appropriate feedback during async operations
- **Validation**: Client-side validation with server-side backup

## Testing Strategy

### Unit Tests
- **Rendering**: Component displays correctly with various props
- **Interactions**: User actions trigger expected behavior
- **Accessibility**: ARIA attributes and keyboard navigation
- **Edge Cases**: Error states, empty data, network failures

### Integration Tests
- **Form Flows**: Complete user journeys through forms
- **API Integration**: Components work with backend services
- **State Management**: Data flows correctly between components

### Visual Testing
- **Storybook**: Visual regression testing for all component states
- **Responsive**: Components work across all screen sizes
- **Themes**: Light/dark mode compatibility

## Performance Considerations

### Bundle Size
- **Tree Shaking**: Only import used components
- **Code Splitting**: Lazy load heavy components
- **Dependencies**: Minimize external dependencies

### Runtime Performance
- **Memoization**: Use React.memo for expensive renders
- **Virtualization**: For large lists and tables
- **Debouncing**: For search and input handlers

## Accessibility Standards

### WCAG 2.1 AA Compliance
- **Keyboard Navigation**: All interactive elements accessible via keyboard
- **Screen Readers**: Proper ARIA labels and descriptions
- **Color Contrast**: Minimum 4.5:1 ratio for text
- **Focus Management**: Clear focus indicators and logical tab order

### Testing Tools
- **axe-core**: Automated accessibility testing
- **Screen Readers**: Manual testing with NVDA/JAWS
- **Keyboard Only**: Navigation without mouse

## Contributing

1. **Create Story**: Add Storybook story for new components
2. **Write Tests**: Comprehensive unit tests required
3. **Documentation**: Update this README and component docs
4. **Review**: All components require design system review
5. **Accessibility**: Test with screen readers and keyboard navigation

## Resources

- [Storybook Documentation](./stories/README.md)
- [Testing Guidelines](./__tests__/README.md)
- [VitalCV Design System](https://vitalcv.com/design-system)
- [shadcn/ui Components](https://ui.shadcn.com)
