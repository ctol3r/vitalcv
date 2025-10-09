# Accessibility Testing Guide

Comprehensive guide for testing WCAG 2.1 AA compliance in VitalCV.

## Overview

VitalCV implements a robust accessibility testing infrastructure to ensure WCAG 2.1 AA compliance. This guide covers:

- **Automated testing** with jest-axe
- **Runtime monitoring** with @axe-core/react
- **Testing utilities** for common accessibility checks
- **Best practices** for writing accessible components

## Table of Contents

- [Setup](#setup)
- [Testing Utilities](#testing-utilities)
- [Writing Accessibility Tests](#writing-accessibility-tests)
- [Runtime Monitoring](#runtime-monitoring)
- [Best Practices](#best-practices)
- [WCAG 2.1 AA Requirements](#wcag-21-aa-requirements)

---

## Setup

### Installed Packages

```json
{
  "devDependencies": {
    "jest-axe": "^10.0.0",
    "axe-core": "^4.10.3",
    "@axe-core/react": "^4.10.2"
  }
}
```

### Jest Configuration

The accessibility testing infrastructure is automatically configured in `jest.setup.js`:

```javascript
import { toHaveNoViolations } from 'jest-axe'

// Extend expect with jest-axe matchers
expect.extend(toHaveNoViolations)
```

---

## Testing Utilities

Located in `lib/test-utils/accessibility.tsx`, these utilities make it easy to write comprehensive accessibility tests.

### 1. expectNoA11yViolations

Run automated accessibility checks on a component.

```typescript
import { expectNoA11yViolations } from '@/lib/test-utils/accessibility'

test('should have no accessibility violations', async () => {
  const { container } = render(<MyComponent />)
  await expectNoA11yViolations(container)
})
```

### 2. renderWithA11yCheck

Render a component and automatically run accessibility tests.

```typescript
import { renderWithA11yCheck } from '@/lib/test-utils/accessibility'

test('button should be accessible', async () => {
  await renderWithA11yCheck(<Button>Click me</Button>)
  // If this doesn't throw, the component is accessible!
})
```

### 3. testKeyboardNavigation

Test keyboard accessibility and focus management.

```typescript
import { testKeyboardNavigation } from '@/lib/test-utils/accessibility'

test('should be keyboard navigable', async () => {
  const { container } = render(<MyForm />)
  const navInfo = await testKeyboardNavigation(container)

  expect(navInfo.focusableElements.length).toBeGreaterThan(0)
  expect(navInfo.tabOrder).toMatchSnapshot()
})
```

### 4. getAriaInfo

Inspect ARIA attributes and landmarks.

```typescript
import { getAriaInfo } from '@/lib/test-utils/accessibility'

test('should have proper ARIA labels', () => {
  const { container } = render(<MyComponent />)
  const ariaInfo = getAriaInfo(container)

  expect(ariaInfo.labels.length).toBeGreaterThan(0)
  expect(ariaInfo.landmarks).toContainEqual(
    expect.objectContaining({ role: 'main' })
  )
})
```

### 5. getAccessibilityTree

Get a tree view of accessibility information for debugging.

```typescript
import { getAccessibilityTree } from '@/lib/test-utils/accessibility'

test('should have proper accessibility tree', () => {
  const { container } = render(<ComplexComponent />)
  const tree = getAccessibilityTree(container)

  console.log(tree) // For debugging
})
```

---

## Writing Accessibility Tests

### Test Structure

Organize accessibility tests by WCAG criteria:

```typescript
describe('MyComponent Accessibility', () => {
  describe('WCAG 2.1 AA Compliance', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<MyComponent />)
      await expectNoA11yViolations(container)
    })
  })

  describe('Keyboard Navigation', () => {
    it('should be keyboard focusable', async () => {
      const { container } = render(<MyComponent />)
      const navInfo = await testKeyboardNavigation(container)
      expect(navInfo.count).toBeGreaterThan(0)
    })
  })

  describe('Screen Reader Support', () => {
    it('should have accessible name', () => {
      render(<MyComponent />)
      const element = screen.getByRole('button', { name: /click me/i })
      expect(element).toBeInTheDocument()
    })
  })

  describe('ARIA Attributes', () => {
    it('should have proper ARIA labels', () => {
      const { container } = render(<MyComponent />)
      const ariaInfo = getAriaInfo(container)
      expect(ariaInfo.labels.length).toBeGreaterThan(0)
    })
  })
})
```

### Example: Button Component

See `__tests__/accessibility/button.a11y.test.tsx` for a comprehensive example:

```typescript
describe('Button Accessibility', () => {
  describe('WCAG 2.1 AA Compliance', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<Button>Click me</Button>)
      await expectNoA11yViolations(container)
    })
  })

  describe('Screen Reader Support', () => {
    it('should have accessible name', () => {
      render(<Button>Click me</Button>)
      const button = screen.getByRole('button', { name: /click me/i })
      expect(button).toBeInTheDocument()
    })

    it('should support aria-label', () => {
      render(<Button aria-label="Custom label">Icon</Button>)
      const button = screen.getByRole('button', { name: /custom label/i })
      expect(button).toBeInTheDocument()
    })

    it('should announce disabled state', () => {
      render(<Button disabled>Disabled</Button>)
      const button = screen.getByRole('button', { name: /disabled/i })
      expect(button).toBeDisabled()
    })
  })
})
```

### Example: Form Input

See `__tests__/accessibility/input.a11y.test.tsx`:

```typescript
describe('Input Accessibility', () => {
  describe('WCAG 2.1 AA Compliance', () => {
    it('should have no accessibility violations with label', async () => {
      const { container } = render(
        <div>
          <Label htmlFor="test-input">Name</Label>
          <Input id="test-input" />
        </div>
      )
      await expectNoA11yViolations(container)
    })
  })

  describe('Form Validation', () => {
    it('should properly associate error messages', async () => {
      const { container } = render(
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            aria-invalid="true"
            aria-describedby="email-error"
          />
          <span id="email-error" role="alert">
            Please enter a valid email
          </span>
        </div>
      )

      await expectNoA11yViolations(container)
    })
  })
})
```

---

## Runtime Monitoring

### AccessibilityProvider

Enable runtime accessibility monitoring in development:

```typescript
// app/layout.tsx
import { AccessibilityProvider } from '@/components/providers/accessibility-provider'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AccessibilityProvider>
          {children}
        </AccessibilityProvider>
      </body>
    </html>
  )
}
```

### AccessibilityMonitor

Add a floating accessibility audit button (development only):

```typescript
import { AccessibilityMonitor } from '@/components/providers/accessibility-provider'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <AccessibilityMonitor />
      </body>
    </html>
  )
}
```

This adds a floating ♿ button that:
- Runs a full accessibility audit
- Displays violations in a side panel
- Shows violation details and affected elements
- Only appears in development mode

### useAccessibilityAudit Hook

Manually trigger accessibility audits:

```typescript
import { useAccessibilityAudit } from '@/components/providers/accessibility-provider'

function MyComponent() {
  const { runAccessibilityAudit } = useAccessibilityAudit()

  const handleAudit = async () => {
    const results = await runAccessibilityAudit()
    console.log('Violations:', results.violations)
    console.log('Passes:', results.passes)
  }

  return <button onClick={handleAudit}>Run Audit</button>
}
```

---

## Best Practices

### 1. Always Use Semantic HTML

```typescript
// ✅ Good
<button onClick={handleClick}>Click me</button>

// ❌ Bad
<div onClick={handleClick}>Click me</div>
```

### 2. Provide Text Alternatives

```typescript
// ✅ Good
<button aria-label="Close dialog">
  <X className="w-4 h-4" />
</button>

// ❌ Bad
<button>
  <X className="w-4 h-4" />
</button>
```

### 3. Use Labels for Form Inputs

```typescript
// ✅ Good
<div>
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" />
</div>

// ❌ Bad
<Input type="email" placeholder="Email" />
```

### 4. Associate Error Messages

```typescript
// ✅ Good
<div>
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    aria-invalid="true"
    aria-describedby="email-error"
  />
  <span id="email-error" role="alert">
    Invalid email format
  </span>
</div>

// ❌ Bad
<div>
  <Input id="email" />
  <span>Invalid email format</span>
</div>
```

### 5. Manage Focus Properly

```typescript
// ✅ Good - Focus management in dialogs
function Dialog({ onClose }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  return (
    <div role="dialog" aria-modal="true">
      <button ref={closeButtonRef} onClick={onClose}>
        Close
      </button>
    </div>
  )
}
```

### 6. Provide Skip Links

```typescript
// ✅ Good
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
<main id="main-content">
  {/* Content */}
</main>
```

### 7. Use ARIA Landmarks

```typescript
// ✅ Good
<header role="banner">
  <nav role="navigation">
    {/* Navigation */}
  </nav>
</header>
<main role="main">
  {/* Main content */}
</main>
<footer role="contentinfo">
  {/* Footer */}
</footer>
```

### 8. Test with Keyboard

Always test:
- Tab navigation
- Enter/Space activation
- Arrow keys (for menus, tabs, etc.)
- Escape key (for modals, dropdowns)

### 9. Test with Screen Readers

Test with popular screen readers:
- **Windows**: NVDA (free), JAWS
- **macOS**: VoiceOver (built-in)
- **Linux**: Orca

---

## WCAG 2.1 AA Requirements

### Level A (Must Have)

1. **Text Alternatives** (1.1.1)
   - All non-text content has text alternative

2. **Keyboard Accessible** (2.1.1)
   - All functionality available via keyboard

3. **No Keyboard Trap** (2.1.2)
   - Keyboard focus can move away from any component

4. **Name, Role, Value** (4.1.2)
   - All UI components have accessible name, role, and state

### Level AA (Should Have)

5. **Contrast** (1.4.3)
   - Text contrast ratio ≥ 4.5:1
   - Large text contrast ratio ≥ 3:1

6. **Resize Text** (1.4.4)
   - Text can be resized up to 200% without loss of content

7. **Focus Visible** (2.4.7)
   - Keyboard focus indicator is visible

8. **Labels or Instructions** (3.3.2)
   - Labels provided when input is required

9. **Error Identification** (3.3.1)
   - Errors are identified and described in text

10. **Error Suggestion** (3.3.3)
    - Suggestions provided when errors detected

---

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Accessibility Tests Only

```bash
npm test -- --testPathPattern=a11y
```

### Run Tests in Watch Mode

```bash
npm test:watch
```

### Generate Coverage Report

```bash
npm test -- --coverage
```

---

## Common Violations and Fixes

### Violation: Button has no accessible name

```typescript
// ❌ Bad
<button>
  <Icon />
</button>

// ✅ Fix
<button aria-label="Close">
  <Icon />
</button>
```

### Violation: Form element has no label

```typescript
// ❌ Bad
<input type="text" />

// ✅ Fix
<div>
  <label htmlFor="name">Name</label>
  <input id="name" type="text" />
</div>
```

### Violation: Insufficient color contrast

```typescript
// ❌ Bad (contrast ratio 2.5:1)
<p className="text-gray-400">Low contrast text</p>

// ✅ Fix (contrast ratio 4.5:1)
<p className="text-gray-700">Good contrast text</p>
```

### Violation: Missing alt text

```typescript
// ❌ Bad
<img src="photo.jpg" />

// ✅ Fix
<img src="photo.jpg" alt="Team photo from 2024 conference" />
```

### Violation: Invalid ARIA attribute

```typescript
// ❌ Bad
<div aria-label="Card" role="card">
  {/* ... */}
</div>

// ✅ Fix
<div aria-label="Card" role="region">
  {/* ... */}
</div>
```

---

## Resources

### Documentation

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [jest-axe Documentation](https://github.com/nickcolley/jest-axe)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)

### Tools

- [axe DevTools Browser Extension](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [Pa11y](https://pa11y.org/)

### Screen Readers

- [NVDA (Windows, Free)](https://www.nvaccess.org/)
- [JAWS (Windows, Paid)](https://www.freedomscientific.com/products/software/jaws/)
- [VoiceOver (macOS/iOS, Built-in)](https://www.apple.com/accessibility/voiceover/)
- [Orca (Linux, Free)](https://help.gnome.org/users/orca/stable/)

---

## Contributing

When adding new components or features:

1. **Write accessibility tests** using the utilities provided
2. **Run automated tests** with `npm test`
3. **Test with keyboard** navigation
4. **Test with screen reader** (at least one)
5. **Check color contrast** with browser DevTools
6. **Run runtime audit** with AccessibilityMonitor
7. **Document** any accessibility considerations

---

## Support

For questions or issues:
- Check the [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- Review existing tests in `__tests__/accessibility/`
- Consult the [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)

---

**Last Updated**: 2025-10-08
**WCAG Version**: 2.1 AA
**Testing Framework**: jest-axe 10.0.0
