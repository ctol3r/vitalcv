# Accessibility Services

This directory contains comprehensive accessibility services for the Chai VC Platform, implementing WCAG 2.1 AA compliance and user accessibility preferences.

## Overview

All services are part of the B242A accessibility feature set, providing:
- User accessibility preference management
- WCAG 2.1 AA compliance auditing
- Color contrast checking
- Text scaling services
- Semantic label management
- Screen reader support
- Form accessibility validation
- Compliance reporting

## Services

### 1. AccessibilitySettingsService (`services/accessibilitySettingsService.ts`)

Manages user accessibility preferences with full CRUD operations:
- Get/create/update/delete preferences
- Apply default settings
- Update session cookies for frontend access

**Usage:**
```typescript
import { accessibilitySettingsService } from './services/accessibility';

// Get preferences (creates defaults if none exist)
const prefs = await accessibilitySettingsService.getPreferences(userId);

// Update preferences
await accessibilitySettingsService.updatePreferences(userId, {
  highContrast: true,
  textSizeScale: 1.5,
});

// Apply to cookies
accessibilitySettingsService.applyPreferencesToCookies(res, prefs);
```

### 2. WCAGComplianceAuditService (`audit/wcagComplianceAuditService.ts`)

Evaluates pages/components against WCAG 2.1 AA criteria:
- Color contrast checks
- Focus order validation
- Alt text presence
- ARIA labels validation

**Usage:**
```typescript
import { wcagComplianceAuditService } from './services/accessibility';

const result = await wcagComplianceAuditService.runAudit({
  colorPairs: [
    { foreground: '#000000', background: '#FFFFFF', element: 'body' }
  ],
  images: [
    { selector: 'img.logo', altText: 'Logo', isDecorative: false }
  ],
  interactiveElements: [
    { selector: 'button.submit', hasAriaLabel: true }
  ]
});
```

### 3. ContrastChecker (`utils/contrastChecker.ts`)

Calculates contrast ratios and checks WCAG compliance:
- Calculate contrast ratio between two colors
- Check WCAG AA/AAA compliance
- Support for normal text, large text, and UI components

**Usage:**
```typescript
import { checkContrast, meetsWCAGAA } from './services/accessibility';

const result = checkContrast('#000000', '#FFFFFF');
console.log(result.contrastRatio); // 21.0
console.log(result.passesNormalTextAA); // true

const passes = meetsWCAGAA('#000000', '#FFFFFF'); // true
```

### 4. FontSizeScalingService (`services/fontSizeScalingService.ts`)

Applies user-defined text scaling:
- Modify CSS variables
- Update document root
- Ensure readability without breaking layout

**Usage:**
```typescript
import { fontSizeScalingService } from './services/accessibility';

// Apply scaling (clamps to safe range 0.5-3.0)
const scale = fontSizeScalingService.applyScaling(1.5);

// Generate CSS
const css = fontSizeScalingService.generateCSS(1.5);

// Calculate scaled size
const scaledSize = fontSizeScalingService.calculateScaledSize(16, 1.5); // 24px
```

### 5. SemanticLabelService (`services/semanticLabelService.ts`)

Manages ARIA labels and descriptions for UI elements:
- Store labels by component and locale
- Fetch labels with fallback to default locale
- CRUD operations for semantic labels

**Usage:**
```typescript
import { semanticLabelService } from './services/accessibility';

// Create/update label
await semanticLabelService.upsertLabel({
  componentId: 'login-button',
  defaultLabel: 'Sign in to your account',
  locale: 'en-US',
  description: 'Button to authenticate user'
});

// Get label with fallback
const label = await semanticLabelService.getLabelWithFallback('login-button', 'es-ES');
```

### 6. ScreenReaderSupportHelper (`services/screenReaderSupportHelper.ts`)

Provides helper functions for screen reader support:
- Add ARIA roles/attributes
- Manage focus
- Announce dynamic content
- Create skip navigation links

**Usage:**
```typescript
import { screenReaderSupportHelper } from './services/accessibility';

// Generate ARIA attributes
const attrs = screenReaderSupportHelper.generateAriaAttributes({
  role: 'button',
  'aria-label': 'Close dialog',
  'aria-live': 'polite'
});

// Announce to screen readers
screenReaderSupportHelper.announce('Form submitted successfully', 'polite');

// Create skip link
const skipLink = screenReaderSupportHelper.createSkipLink('#main-content');
```

### 7. AccessibleFormValidator (`validation/accessibleFormValidator.ts`)

Validates forms for accessible patterns:
- Required field announcements
- Error message association
- Keyboard navigation
- Accessible name validation

**Usage:**
```typescript
import { accessibleFormValidator } from './services/accessibility';

const result = accessibleFormValidator.validateForm([
  {
    id: 'email',
    name: 'email',
    type: 'email',
    required: true,
    label: 'Email Address'
  }
]);

if (!result.valid) {
  console.log(result.issues);
}
```

### 8. AccessibilityReportGenerator (`reports/accessibilityReportGenerator.ts`)

Generates accessibility compliance reports:
- Summarize audit results
- Highlight improvements and regressions
- Export in CSV/JSON/Markdown formats

**Usage:**
```typescript
import { accessibilityReportGenerator } from './services/accessibility';

const report = accessibilityReportGenerator.generateSummary(auditResults);

// Export to different formats
const csv = accessibilityReportGenerator.exportToCSV(report);
const json = accessibilityReportGenerator.exportToJSON(report);
const markdown = accessibilityReportGenerator.exportToMarkdown(report);
```

## Database Models

### AccessibilityPreference

Stores user accessibility preferences:
- `id`: Unique identifier
- `userId`: Foreign key to User
- `highContrast`: Boolean for high contrast mode
- `textSizeScale`: Float for text scaling (default: 1.0)
- `enableCaptions`: Boolean for caption preference
- `reduceMotion`: Boolean for reduced motion preference

### SemanticLabel

Stores ARIA labels and descriptions:
- `id`: Unique identifier
- `componentId`: UI component identifier
- `defaultLabel`: ARIA label text
- `locale`: Language code (default: 'en-US')
- `description`: Optional ARIA description

## Testing

Comprehensive test suite in `tests/accessibilityTests.test.ts` covering:
- Preference storage and retrieval
- WCAG compliance auditing
- Contrast checking
- Text scaling
- Semantic labels
- Screen reader support
- Form validation
- Report generation

Run tests with:
```bash
npm test -- accessibilityTests.test.ts
```

## Migration

To apply the database migration:
```bash
npx prisma migrate deploy
```

Or for development:
```bash
npx prisma migrate dev
```

## Integration

All services are exported from `index.ts`:

```typescript
import {
  accessibilitySettingsService,
  wcagComplianceAuditService,
  checkContrast,
  fontSizeScalingService,
  semanticLabelService,
  screenReaderSupportHelper,
  accessibleFormValidator,
  accessibilityReportGenerator
} from './services/accessibility';
```

## WCAG 2.1 AA Compliance

All services are designed to help achieve and maintain WCAG 2.1 Level AA compliance:
- **1.4.3 Contrast (Minimum)**: ContrastChecker validates color contrast
- **2.4.3 Focus Order**: WCAGComplianceAuditService checks focus order
- **1.1.1 Non-text Content**: Alt text validation
- **4.1.2 Name, Role, Value**: ARIA label validation
- **3.3.2 Labels or Instructions**: Form validation

## Next Steps

1. Integrate services into API routes
2. Add frontend components to consume preferences
3. Set up scheduled compliance audits
4. Configure automated reporting
5. Add monitoring and alerting for accessibility regressions

