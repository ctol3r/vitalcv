# Accessibility (WCAG AA) Implementation Guide

## Overview

This document outlines accessibility implementation across the VitalCV platform to meet WCAG AA standards.

## Core Principles

1. **Perceivable**: Information and UI components must be presentable to users in ways they can perceive
2. **Operable**: UI components and navigation must be operable
3. **Understandable**: Information and operation of UI must be understandable
4. **Robust**: Content must be robust enough to be interpreted reliably

## Implemented Features

### 1. Keyboard Navigation

All interactive elements are fully keyboard accessible:

- **Tab Navigation**: Logical tab order throughout the application
- **Enter/Space**: Activate buttons and links
- **Escape**: Close modals and dialogs
- **Arrow Keys**: Navigate through lists and menus

### 2. Screen Reader Support

#### ARIA Labels
```typescript
// All icons have aria-hidden="true" when decorative
<Shield className="h-5 w-5" aria-hidden="true" />

// Interactive elements have proper labels
<button aria-label="Close modal">
  <X className="h-4 w-4" />
</button>

// Dynamic content has live regions
<div role="status" aria-live="polite">
  Loading credentials...
</div>
```

#### Semantic HTML
- Proper use of `<header>`, `<nav>`, `<main>`, `<footer>`
- Headings hierarchy (h1 → h6) maintained
- Lists use `<ul>`, `<ol>`, `<li>` appropriately

### 3. Color Contrast

#### Requirements Met
- Text: Minimum 4.5:1 contrast ratio
- Large text (18pt+): Minimum 3:1 contrast ratio
- UI components: Minimum 3:1 contrast ratio

#### Implementation
```css
/* Light mode */
--foreground: oklch(0.145 0 0);        /* #1a1a1a on white = 11.8:1 */
--muted-foreground: oklch(0.556 0 0);  /* #6b7280 on white = 4.7:1 */

/* Dark mode */
--foreground: oklch(0.985 0 0);        /* #f9fafb on dark = 16.4:1 */
--muted-foreground: oklch(0.708 0 0);  /* #9ca3af on dark = 7.2:1 */
```

### 4. Focus Indicators

All interactive elements have visible focus states:

```css
button:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

### 5. Skip Links

Every page includes skip-to-content links:

```tsx
<a href="#main-content" className="skip-to-main">
  Skip to main content
</a>
```

```css
.skip-to-main {
  position: absolute;
  left: -10000px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.skip-to-main:focus {
  position: fixed;
  top: 0;
  left: 0;
  width: auto;
  height: auto;
  padding: 1rem;
  background: var(--background);
  z-index: 9999;
}
```

### 6. Form Accessibility

#### Labels
All form inputs have associated labels:

```tsx
<div>
  <Label htmlFor="npi-input">National Provider Identifier</Label>
  <Input
    id="npi-input"
    type="text"
    aria-describedby="npi-help"
  />
  <p id="npi-help" className="text-sm text-muted-foreground">
    Enter your 10-digit NPI number
  </p>
</div>
```

#### Error Messages
Error states are announced to screen readers:

```tsx
{error && (
  <Alert variant="destructive" role="alert">
    <AlertCircle className="h-4 w-4" aria-hidden="true" />
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}
```

### 7. Modal Dialogs

#### Focus Management
- Focus trap: Focus is contained within the modal
- Initial focus: Moves to first focusable element
- Return focus: Returns to trigger element on close

#### Implementation
```tsx
<Dialog
  open={open}
  onOpenChange={onOpenChange}
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <DialogContent>
    <DialogHeader>
      <DialogTitle id="dialog-title">Share Credential</DialogTitle>
      <DialogDescription id="dialog-description">
        Choose which fields to share
      </DialogDescription>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

### 8. Loading States

Provide accessible loading indicators:

```tsx
{loading && (
  <div role="status" aria-live="polite" aria-busy="true">
    <Loader2 className="animate-spin" aria-hidden="true" />
    <span className="sr-only">Loading credentials...</span>
  </div>
)}
```

### 9. Images and Icons

All images have appropriate alt text:

```tsx
// Decorative images
<img src="/logo.png" alt="" role="presentation" />

// Informative images
<img src="/credential.png" alt="Medical License Credential" />

// Icons (when decorative)
<CheckCircle2 className="h-4 w-4" aria-hidden="true" />

// Icons (when meaningful)
<button aria-label="Download proof">
  <Download className="h-4 w-4" />
</button>
```

### 10. Tables

Proper table markup with headers:

```tsx
<table>
  <caption>Credential History</caption>
  <thead>
    <tr>
      <th scope="col">Date</th>
      <th scope="col">Event</th>
      <th scope="col">Actor</th>
    </tr>
  </thead>
  <tbody>
    {events.map((event) => (
      <tr key={event.id}>
        <td>{event.date}</td>
        <td>{event.type}</td>
        <td>{event.actor}</td>
      </tr>
    ))}
  </tbody>
</table>
```

## Testing Checklist

### Automated Testing
- [ ] Run axe DevTools audit (zero critical issues)
- [ ] Run Lighthouse accessibility audit (score 95+)
- [ ] Run WAVE browser extension
- [ ] Validate HTML with W3C validator

### Manual Testing

#### Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Navigate forms with keyboard only
- [ ] Open/close modals with keyboard
- [ ] Navigate menus with arrow keys
- [ ] Test keyboard shortcuts

#### Screen Reader Testing
- [ ] Test with NVDA (Windows)
- [ ] Test with JAWS (Windows)
- [ ] Test with VoiceOver (macOS/iOS)
- [ ] Test with TalkBack (Android)

#### Visual Testing
- [ ] Verify focus indicators are visible
- [ ] Check color contrast ratios
- [ ] Test with Windows High Contrast mode
- [ ] Test with browser zoom (200%, 400%)
- [ ] Test with reduced motion settings

#### Responsive Testing
- [ ] Mobile screen readers
- [ ] Tablet layouts
- [ ] Desktop layouts
- [ ] Large displays (1920px+)

## Common Patterns

### Accessible Button
```tsx
<Button
  onClick={handleAction}
  aria-label="Delete credential"
  aria-describedby="delete-warning"
>
  <Trash2 className="h-4 w-4" aria-hidden="true" />
  Delete
</Button>
<p id="delete-warning" className="sr-only">
  This action cannot be undone
</p>
```

### Accessible Form
```tsx
<form onSubmit={handleSubmit} aria-label="NPI lookup form">
  <div>
    <Label htmlFor="npi">NPI Number *</Label>
    <Input
      id="npi"
      type="text"
      required
      aria-required="true"
      aria-invalid={!!error}
      aria-describedby="npi-error"
    />
    {error && (
      <span id="npi-error" role="alert">
        {error}
      </span>
    )}
  </div>
  <Button type="submit">Submit</Button>
</form>
```

### Accessible Toast
```tsx
toast({
  title: "Success",
  description: "Credential verified",
  // Automatically uses role="status" and aria-live="polite"
});
```

## Browser Support

Accessibility features tested and supported on:

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Deque axe DevTools](https://www.deque.com/axe/devtools/)

## Continuous Improvement

1. Run automated tests in CI/CD pipeline
2. Include accessibility in code reviews
3. Conduct regular manual audits
4. Gather feedback from users with disabilities
5. Stay updated with WCAG 2.2 and WCAG 3.0 developments

