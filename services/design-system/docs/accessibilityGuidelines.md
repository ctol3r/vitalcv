# Accessibility Guidelines

Comprehensive guidelines for creating accessible user interfaces that meet WCAG 2.1 AA standards and provide an inclusive experience for all users.

## Table of Contents

- [Overview](#overview)
- [WCAG Principles](#wcag-principles)
- [Focus Management](#focus-management)
- [Keyboard Navigation](#keyboard-navigation)
- [ARIA Roles and Attributes](#aria-roles-and-attributes)
- [Color and Contrast](#color-and-contrast)
- [Form Labeling](#form-labeling)
- [Screen Reader Support](#screen-reader-support)
- [Testing](#testing)
- [Resources](#resources)

---

## Overview

Accessibility ensures that our platform is usable by everyone, including people with disabilities. We follow WCAG 2.1 Level AA standards as our minimum requirement.

### Key Principles

1. **Perceivable** - Information must be presentable to users in ways they can perceive
2. **Operable** - Interface components must be operable by all users
3. **Understandable** - Information and UI operation must be understandable
4. **Robust** - Content must be robust enough for various assistive technologies

---

## WCAG Principles

### Perceivable

#### Text Alternatives
- Provide alt text for all images
- Use descriptive link text
- Provide captions for multimedia

#### Time-based Media
- Provide captions for video
- Provide transcripts for audio
- Avoid auto-playing media

#### Adaptable
- Use semantic HTML
- Ensure content can be presented in different ways
- Maintain information relationships

#### Distinguishable
- Ensure sufficient color contrast (4.5:1 for text)
- Don't rely solely on color to convey information
- Provide text alternatives for color-coded information

### Operable

#### Keyboard Accessible
- All functionality available via keyboard
- No keyboard traps
- Logical tab order

#### Enough Time
- Provide sufficient time to read content
- Allow users to extend time limits
- Avoid auto-advancing content

#### Seizures and Physical Reactions
- Avoid flashing content (more than 3 flashes per second)
- Provide warnings for potentially harmful content

#### Navigable
- Provide skip links
- Use clear headings
- Provide multiple navigation methods

#### Input Modalities
- Support pointer gestures
- Provide alternative input methods
- Ensure touch targets are at least 44x44px

### Understandable

#### Readable
- Use clear, simple language
- Define abbreviations and jargon
- Provide pronunciation guidance when needed

#### Predictable
- Maintain consistent navigation
- Use consistent labeling
- Provide clear error messages

#### Input Assistance
- Identify input errors clearly
- Provide suggestions for correction
- Prevent and correct mistakes

### Robust

#### Compatible
- Use valid HTML
- Use proper ARIA attributes
- Ensure compatibility with assistive technologies

---

## Focus Management

### Visible Focus Indicators

All interactive elements must have visible focus indicators:

```css
/* Default focus ring */
.focus-visible:ring-2 {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

### Focus Order

- Maintain logical tab order
- Use `tabIndex` appropriately (avoid positive values)
- Return focus to trigger after closing modals
- Trap focus within dialogs and modals

### Skip Links

Provide skip links for keyboard users:

```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-primary focus:text-primary-foreground">
  Skip to main content
</a>
```

### Focus Management in Modals

```tsx
// Trap focus within modal
useEffect(() => {
  if (isOpen) {
    const firstFocusable = modalRef.current?.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    firstFocusable?.focus()
  }
}, [isOpen])
```

---

## Keyboard Navigation

### Standard Keyboard Shortcuts

- **Tab** - Move forward through interactive elements
- **Shift+Tab** - Move backward through interactive elements
- **Enter/Space** - Activate buttons and links
- **Escape** - Close modals, dialogs, and dropdowns
- **Arrow Keys** - Navigate within components (tabs, menus, etc.)

### Custom Keyboard Shortcuts

When implementing custom shortcuts:

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      onClose()
    }
  }
  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [isOpen, onClose])
```

### Keyboard Traps

Avoid keyboard traps. Always provide a way to exit:

```tsx
// Good: Escape key closes modal
<Dialog open={open} onOpenChange={setOpen}>
  {/* content */}
</Dialog>

// Bad: No way to close
<div className="fixed inset-0 bg-black/50">
  {/* content without close button or escape handler */}
</div>
```

---

## ARIA Roles and Attributes

### Common ARIA Roles

#### Landmarks
- `role="banner"` - Site header
- `role="navigation"` - Navigation menus
- `role="main"` - Main content area
- `role="complementary"` - Sidebars
- `role="contentinfo"` - Footer

#### Widgets
- `role="button"` - Custom button elements
- `role="dialog"` - Modal dialogs
- `role="alert"` - Important messages
- `role="status"` - Status updates
- `role="tablist"` - Tab containers
- `role="tab"` - Individual tabs

### ARIA Attributes

#### aria-label
Provide accessible names when text is not visible:

```tsx
<button aria-label="Close dialog">
  <X className="h-4 w-4" />
</button>
```

#### aria-describedby
Link elements to descriptions:

```tsx
<input
  id="email"
  aria-describedby="email-error email-help"
/>
<p id="email-error" className="text-destructive">Error message</p>
<p id="email-help" className="text-muted">Help text</p>
```

#### aria-expanded
Indicate expandable/collapsible state:

```tsx
<button
  aria-expanded={isOpen}
  aria-controls="menu"
>
  Menu
</button>
```

#### aria-hidden
Hide decorative elements from screen readers:

```tsx
<span aria-hidden="true">✨</span>
<span className="sr-only">New feature</span>
```

#### aria-live
Announce dynamic content changes:

```tsx
<div aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>
```

### ARIA Best Practices

- Use semantic HTML first, ARIA as enhancement
- Don't override native semantics unnecessarily
- Test with screen readers
- Keep ARIA attributes up to date with component state

---

## Color and Contrast

### Contrast Ratios

- **Normal text (16px+):** 4.5:1 minimum
- **Large text (18px+ or 14px+ bold):** 3:1 minimum
- **UI components:** 3:1 minimum
- **Graphics and charts:** 3:1 minimum

### Color Contrast Checker

Use tools to verify contrast:
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Colour Contrast Analyser](https://www.tpgi.com/color-contrast-checker/)

### Don't Rely on Color Alone

```tsx
// Bad: Only color indicates status
<div className={status === 'error' ? 'text-red-500' : 'text-green-500'}>
  Status
</div>

// Good: Color + icon + text
<div className="flex items-center gap-2">
  {status === 'error' ? (
    <>
      <AlertCircle className="h-4 w-4 text-destructive" />
      <span>Error: Please check your input</span>
    </>
  ) : (
    <>
      <CheckCircle className="h-4 w-4 text-success" />
      <span>Success: All checks passed</span>
    </>
  )}
</div>
```

---

## Form Labeling

### Proper Label Association

```tsx
// Good: Explicit association
<Label htmlFor="email">Email</Label>
<Input id="email" type="email" />

// Good: Implicit association
<Label>
  Email
  <Input type="email" />
</Label>

// Bad: No association
<Label>Email</Label>
<Input type="email" />
```

### Required Fields

```tsx
<Label htmlFor="name">
  Name
  <span className="text-destructive" aria-label="required">*</span>
</Label>
<Input id="name" required aria-required="true" />
```

### Error Messages

```tsx
<div>
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    aria-invalid={hasError}
    aria-describedby={hasError ? 'email-error' : undefined}
  />
  {hasError && (
    <p id="email-error" className="text-destructive" role="alert">
      Please enter a valid email address
    </p>
  )}
</div>
```

### Help Text

```tsx
<Label htmlFor="password">Password</Label>
<Input
  id="password"
  type="password"
  aria-describedby="password-help"
/>
<p id="password-help" className="text-sm text-muted-foreground">
  Must be at least 8 characters
</p>
```

---

## Screen Reader Support

### Semantic HTML

Use semantic HTML elements:

```tsx
// Good
<nav>
  <ul>
    <li><a href="/">Home</a></li>
    <li><a href="/about">About</a></li>
  </ul>
</nav>

// Bad
<div>
  <div onClick={goHome}>Home</div>
  <div onClick={goAbout}>About</div>
</div>
```

### Screen Reader Only Content

```tsx
// Provide context for screen readers
<button>
  <span className="sr-only">Close dialog</span>
  <X className="h-4 w-4" />
</button>
```

### Live Regions

Announce dynamic content:

```tsx
<div aria-live="polite" aria-atomic="true">
  {notification}
</div>

// Use "assertive" for urgent messages
<div aria-live="assertive" role="alert">
  {errorMessage}
</div>
```

---

## Testing

### Automated Testing

- Use axe-core for automated accessibility testing
- Run tests in CI/CD pipeline
- Test with multiple screen readers

### Manual Testing

1. **Keyboard Navigation**
   - Tab through all interactive elements
   - Verify focus indicators are visible
   - Test all keyboard shortcuts

2. **Screen Reader Testing**
   - Test with NVDA (Windows)
   - Test with JAWS (Windows)
   - Test with VoiceOver (macOS/iOS)
   - Test with TalkBack (Android)

3. **Color Contrast**
   - Verify all text meets contrast requirements
   - Test in both light and dark modes
   - Check focus indicators

4. **Form Testing**
   - Verify all inputs have labels
   - Test error message announcements
   - Verify required field indicators

### Testing Tools

- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE](https://wave.webaim.org/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [Pa11y](https://pa11y.org/)

---

## Resources

### WCAG References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WCAG 2.1 Understanding](https://www.w3.org/WAI/WCAG21/Understanding/)
- [WebAIM](https://webaim.org/)

### ARIA Resources

- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [MDN ARIA Documentation](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA)

### Screen Reader Guides

- [NVDA Guide](https://www.nvaccess.org/about-nvda/)
- [JAWS Guide](https://www.freedomscientific.com/products/software/jaws/)
- [VoiceOver Guide](https://www.apple.com/accessibility/vision/)

### Color Contrast

- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Contrast Ratio Calculator](https://contrast-ratio.com/)

---

## Checklist

Use this checklist when building components:

- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are visible
- [ ] All images have alt text
- [ ] Color contrast meets WCAG AA standards
- [ ] Forms have proper labels and error messages
- [ ] ARIA attributes are used correctly
- [ ] Semantic HTML is used appropriately
- [ ] Screen reader testing completed
- [ ] Keyboard navigation tested
- [ ] No keyboard traps
- [ ] Dynamic content is announced to screen readers
- [ ] Error states are clearly communicated

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-16 | Initial accessibility guidelines |

