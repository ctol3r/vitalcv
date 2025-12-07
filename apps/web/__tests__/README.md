# VitalCV Frontend Tests

This directory contains comprehensive unit tests for all UI components and pages in the VitalCV frontend application.

## Test Structure

### Component Tests (`/components/`)
- **CredentialStatusCard**: Status display, QR generation, sharing functionality
- **UploadDropzone**: File upload, drag-and-drop, progress tracking
- **Field Components**: Form validation, error handling, accessibility
- **Toast**: Notification display, variants, user interactions
- **Skeleton**: Loading states, different layouts

### Page Tests (`/pages/`)
- **Dashboard**: User interface, data loading, interactions
- **Verify**: Credential verification flow, form handling
- **Profile**: User profile management, settings
- **Settings**: Configuration options, form validation

## Testing Patterns

### Mocking Strategy
- **API Calls**: Mocked with MSW (Mock Service Worker)
- **Next.js Router**: Mocked navigation functions
- **File Operations**: Mocked File API and drag-and-drop
- **Clipboard**: Mocked for copy functionality
- **External Libraries**: Mocked react-dropzone, etc.

### Test Categories
1. **Rendering Tests**: Component displays correctly with props
2. **Interaction Tests**: User actions trigger expected behavior
3. **Error Handling**: Components handle error states gracefully
4. **Accessibility Tests**: ARIA attributes, keyboard navigation
5. **Integration Tests**: Components work together properly

### Best Practices
- Use `screen` queries for better accessibility testing
- Test user behavior, not implementation details
- Mock external dependencies consistently
- Use `waitFor` for async operations
- Test error boundaries and edge cases

## Running Tests

\`\`\`bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test CredentialStatusCard.test.tsx
\`\`\`

## Coverage Goals
- **Components**: 90%+ coverage for all shared UI components
- **Pages**: 80%+ coverage for main user flows
- **Utilities**: 95%+ coverage for helper functions
- **Integration**: Key user journeys tested end-to-end

## Mock Data
Test fixtures and mock data are organized by component/feature:
- Credential verification results
- User profile data
- File upload scenarios
- API response formats
\`\`\`

```tsx file="" isHidden
