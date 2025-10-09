# ARIA (Accessible Rich Internet Applications) Guide

Comprehensive guide for implementing WAI-ARIA in VitalCV components.

## Overview

ARIA provides semantic information to assistive technologies (screen readers, etc.) about the role, state, and properties of UI elements.

**Golden Rule**: Only use ARIA when semantic HTML is insufficient.

```typescript
// ✅ Good - Semantic HTML
<button>Click me</button>

// ❌ Bad - Unnecessary ARIA
<div role="button" tabIndex={0} onClick={handleClick}>Click me</div>
```

---

## Table of Contents

- [ARIA Roles](#aria-roles)
- [ARIA States](#aria-states)
- [ARIA Properties](#aria-properties)
- [Common Patterns](#common-patterns)
- [Component Examples](#component-examples)
- [Testing ARIA](#testing-aria)

---

## ARIA Roles

### Landmark Roles

Define page structure for navigation:

```typescript
<header role="banner">
  <nav role="navigation">
    {/* Navigation links */}
  </nav>
</header>

<main role="main">
  {/* Main content */}
</main>

<aside role="complementary">
  {/* Sidebar content */}
</aside>

<footer role="contentinfo">
  {/* Footer content */}
</footer>
```

### Widget Roles

Interactive components:

```typescript
// Button
<button role="button">Submit</button>

// Checkbox
<input type="checkbox" role="checkbox" />

// Tab
<div role="tab" aria-selected="true">Tab 1</div>

// Tabpanel
<div role="tabpanel" aria-labelledby="tab-1">
  Panel content
</div>

// Dialog
<div role="dialog" aria-modal="true">
  Modal content
</div>

// Menu
<div role="menu">
  <div role="menuitem">Option 1</div>
  <div role="menuitem">Option 2</div>
</div>
```

### Document Structure Roles

```typescript
// Article
<article>News article content</article>

// List
<ul role="list">
  <li role="listitem">Item 1</li>
</ul>

// Definition
<dl>
  <dt>Term</dt>
  <dd>Definition</dd>
</dl>
```

---

## ARIA States

### aria-expanded

Indicates if element is expanded or collapsed:

```typescript
<button
  aria-expanded={isOpen}
  aria-controls="dropdown-menu"
>
  Menu {isOpen ? '▼' : '▶'}
</button>

<div id="dropdown-menu" hidden={!isOpen}>
  Dropdown content
</div>
```

### aria-selected

Indicates if element is selected (tabs, options):

```typescript
<div role="tablist">
  <button
    role="tab"
    aria-selected={activeTab === 'tab1'}
    aria-controls="panel1"
  >
    Tab 1
  </button>
  <button
    role="tab"
    aria-selected={activeTab === 'tab2'}
    aria-controls="panel2"
  >
    Tab 2
  </button>
</div>
```

### aria-pressed

Indicates toggle button state:

```typescript
<button
  aria-pressed={isActive}
  onClick={() => setIsActive(!isActive)}
>
  {isActive ? 'Active' : 'Inactive'}
</button>
```

### aria-checked

Indicates checkbox/radio state (use with custom controls):

```typescript
<div
  role="checkbox"
  aria-checked={isChecked}
  onClick={() => setIsChecked(!isChecked)}
  tabIndex={0}
>
  {isChecked ? '☑' : '☐'} Custom checkbox
</div>
```

### aria-disabled

Indicates disabled state:

```typescript
<button aria-disabled="true" onClick={handleClick}>
  Disabled button
</button>
```

### aria-invalid

Indicates validation error:

```typescript
<input
  type="email"
  aria-invalid={!!error}
  aria-describedby={error ? 'email-error' : undefined}
/>
{error && (
  <span id="email-error" role="alert">
    {error}
  </span>
)}
```

---

## ARIA Properties

### aria-label

Provides accessible name:

```typescript
<button aria-label="Close dialog">
  <X className="w-4 h-4" />
</button>
```

### aria-labelledby

References element(s) that label the current element:

```typescript
<div role="dialog" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Confirm Action</h2>
  {/* Dialog content */}
</div>
```

### aria-describedby

References element(s) that describe the current element:

```typescript
<input
  type="password"
  aria-describedby="password-requirements"
/>
<p id="password-requirements">
  Password must be at least 8 characters
</p>
```

### aria-controls

References element controlled by current element:

```typescript
<button
  aria-expanded={isOpen}
  aria-controls="menu"
>
  Open Menu
</button>
<div id="menu" hidden={!isOpen}>
  Menu content
</div>
```

### aria-live

Announces dynamic content changes:

```typescript
// Polite: announces when user is idle
<div aria-live="polite" aria-atomic="true">
  {successMessage}
</div>

// Assertive: announces immediately
<div aria-live="assertive" role="alert">
  {errorMessage}
</div>

// Off: no announcements (default)
<div aria-live="off">
  {content}
</div>
```

### aria-atomic

Indicates if entire region should be announced:

```typescript
<div aria-live="polite" aria-atomic="true">
  <p>Step {currentStep} of {totalSteps}</p>
</div>
// Announces: "Step 2 of 5" (entire region)

<div aria-live="polite" aria-atomic="false">
  <p>Step <span>{currentStep}</span> of {totalSteps}</p>
</div>
// Announces: "2" (only changed content)
```

### aria-busy

Indicates element is being updated:

```typescript
<div aria-busy={isLoading} aria-live="polite">
  {isLoading ? 'Loading...' : data}
</div>
```

### aria-current

Indicates current item in set:

```typescript
// Page navigation
<nav>
  <a href="/" aria-current={pathname === '/' ? 'page' : undefined}>
    Home
  </a>
  <a href="/about" aria-current={pathname === '/about' ? 'page' : undefined}>
    About
  </a>
</nav>

// Steps
<ol>
  <li aria-current={step === 1 ? 'step' : undefined}>Step 1</li>
  <li aria-current={step === 2 ? 'step' : undefined}>Step 2</li>
  <li aria-current={step === 3 ? 'step' : undefined}>Step 3</li>
</ol>
```

---

## Common Patterns

### Form Field with Error

```typescript
import { getFieldAriaAttributes } from '@/lib/utils/aria'

function FormField({ error, description }: { error?: string; description?: string }) {
  const fieldId = 'email-input'
  const ariaAttrs = getFieldAriaAttributes(fieldId, error, description)

  return (
    <div>
      <label htmlFor={fieldId}>Email</label>
      <input
        id={fieldId}
        type="email"
        {...ariaAttrs}
      />
      {description && (
        <p id={`${fieldId}-description`} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
```

### Dialog/Modal

```typescript
import { getDialogAriaAttributes } from '@/lib/utils/aria'

function Dialog({ title, description }: { title: string; description?: string }) {
  const titleId = 'dialog-title'
  const descId = description ? 'dialog-description' : undefined
  const ariaAttrs = getDialogAriaAttributes(titleId, descId)

  return (
    <div {...ariaAttrs}>
      <h2 id={titleId}>{title}</h2>
      {description && <p id={descId}>{description}</p>}
      {/* Dialog content */}
    </div>
  )
}
```

### Tabs

```typescript
import { getTabsAriaAttributes } from '@/lib/utils/aria'

function Tabs({ tabs }: { tabs: Array<{ id: string; label: string; content: ReactNode }> }) {
  const [activeTab, setActiveTab] = useState(tabs[0].id)

  return (
    <div>
      <div role="tablist">
        {tabs.map((tab) => {
          const attrs = getTabsAriaAttributes(tab.id, `panel-${tab.id}`)
          return (
            <button
              key={tab.id}
              {...attrs.tab}
              aria-selected={activeTab === tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      {tabs.map((tab) => {
        const attrs = getTabsAriaAttributes(tab.id, `panel-${tab.id}`)
        return (
          <div
            key={tab.id}
            {...attrs.panel}
            hidden={activeTab !== tab.id}
          >
            {tab.content}
          </div>
        )
      })}
    </div>
  )
}
```

### Live Region Announcer

```typescript
import { announce } from '@/lib/utils/aria'

function SaveButton() {
  const handleSave = async () => {
    await saveData()
    announce('Changes saved successfully', 'polite')
  }

  return <button onClick={handleSave}>Save</button>
}

// Add this to your root layout:
// <div
//   id="aria-live-announcer"
//   role="status"
//   aria-live="polite"
//   aria-atomic="true"
//   className="sr-only"
// />
```

### Progress Bar

```typescript
import { getProgressAriaAttributes } from '@/lib/utils/aria'

function ProgressBar({ value, max = 100, label }: { value: number; max?: number; label?: string }) {
  const ariaAttrs = getProgressAriaAttributes(value, max, label)

  return (
    <div {...ariaAttrs} className="w-full bg-secondary h-2 rounded">
      <div
        className="bg-primary h-full rounded"
        style={{ width: `${(value / max) * 100}%` }}
      />
    </div>
  )
}
```

### Loading Spinner

```typescript
import { getLoadingAriaAttributes } from '@/lib/utils/aria'

function Spinner({ label = 'Loading' }: { label?: string }) {
  const ariaAttrs = getLoadingAriaAttributes(label)

  return (
    <div {...ariaAttrs}>
      <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
```

### Alert

```typescript
import { getAlertAriaAttributes } from '@/lib/utils/aria'

function Alert({ type, message }: { type: 'info' | 'success' | 'warning' | 'error'; message: string }) {
  const ariaAttrs = getAlertAriaAttributes(type)

  return (
    <div {...ariaAttrs} className={`alert alert-${type}`}>
      {message}
    </div>
  )
}
```

---

## Component Examples

### Accessible Button

```typescript
<button
  type="button"
  aria-label="Close dialog"
  onClick={onClose}
>
  <X className="w-4 h-4" aria-hidden="true" />
</button>
```

### Accessible Icon Button

```typescript
<button aria-label="Delete item">
  <Trash className="w-4 h-4" aria-hidden="true" />
  <span className="sr-only">Delete</span>
</button>
```

### Accessible Link

```typescript
<a href="/dashboard" aria-current={pathname === '/dashboard' ? 'page' : undefined}>
  Dashboard
</a>
```

### Accessible Dropdown

```typescript
function Dropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const menuId = 'dropdown-menu'

  return (
    <div>
      <button
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen(!isOpen)}
      >
        Menu
      </button>
      <div id={menuId} role="menu" hidden={!isOpen}>
        <button role="menuitem">Option 1</button>
        <button role="menuitem">Option 2</button>
      </div>
    </div>
  )
}
```

### Accessible Accordion

```typescript
function Accordion({ title, content }: { title: string; content: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerId = 'accordion-trigger'
  const panelId = 'accordion-panel'

  const attrs = getDisclosureAriaAttributes(triggerId, panelId, isOpen)

  return (
    <div>
      <button
        {...attrs.trigger}
        onClick={() => setIsOpen(!isOpen)}
      >
        {title}
      </button>
      <div {...attrs.panel} hidden={!isOpen}>
        {content}
      </div>
    </div>
  )
}
```

---

## Testing ARIA

### Automated Testing

```typescript
import { render, screen } from '@testing-library/react'
import { getAriaInfo } from '@/lib/test-utils/accessibility'

test('button has proper ARIA attributes', () => {
  render(<Button aria-label="Close">×</Button>)

  const button = screen.getByRole('button', { name: /close/i })
  expect(button).toBeInTheDocument()
})

test('dialog has proper ARIA attributes', () => {
  render(<Dialog title="Confirm" />)

  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog).toHaveAttribute('aria-labelledby')
})

test('form field has error ARIA', () => {
  render(<Input aria-invalid="true" aria-describedby="error" />)

  const input = screen.getByRole('textbox')
  expect(input).toHaveAttribute('aria-invalid', 'true')
})
```

### Manual Testing

1. **Keyboard Navigation**
   - Tab through all interactive elements
   - Verify focus order makes sense
   - Check focus indicators are visible

2. **Screen Reader Testing**
   - Use NVDA (Windows), JAWS (Windows), or VoiceOver (macOS)
   - Navigate with screen reader shortcuts
   - Verify all content is announced correctly

3. **Browser DevTools**
   - Chrome: Accessibility pane in DevTools
   - Firefox: Accessibility panel
   - Check ARIA tree structure

---

## Best Practices

### 1. Use Semantic HTML First

```typescript
// ✅ Good
<button onClick={handleClick}>Click me</button>

// ❌ Bad
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
  Click me
</div>
```

### 2. Don't Override Semantics

```typescript
// ❌ Bad
<button role="link">Click me</button>

// ✅ Good
<a href="/page">Click me</a>
```

### 3. Always Label Interactive Elements

```typescript
// ✅ Good
<button aria-label="Close dialog">
  <X />
</button>

// ❌ Bad
<button>
  <X />
</button>
```

### 4. Use aria-hidden for Decorative Icons

```typescript
// ✅ Good
<button aria-label="Search">
  <Search aria-hidden="true" />
</button>

// ❌ Bad
<button>
  <Search />
</button>
```

### 5. Announce Dynamic Content

```typescript
// ✅ Good
<div aria-live="polite" role="status">
  {successMessage}
</div>

// ❌ Bad
<div>{successMessage}</div>
```

### 6. Manage Focus

```typescript
// ✅ Good
useEffect(() => {
  if (isOpen) {
    dialogRef.current?.focus()
  }
}, [isOpen])

// ❌ Bad - No focus management
```

### 7. Provide Context

```typescript
// ✅ Good
<button aria-label="Delete user John Doe">
  Delete
</button>

// ❌ Bad - Unclear what will be deleted
<button aria-label="Delete">
  Delete
</button>
```

---

## Resources

### WAI-ARIA Authoring Practices

- [ARIA Authoring Practices Guide (APG)](https://www.w3.org/WAI/ARIA/apg/)
- [ARIA Roles Reference](https://www.w3.org/TR/wai-aria-1.2/#role_definitions)
- [ARIA States and Properties](https://www.w3.org/TR/wai-aria-1.2/#state_prop_def)

### Tools

- [Accessibility Insights](https://accessibilityinsights.io/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [ARIA Practices Examples](https://www.w3.org/WAI/ARIA/apg/example-index/)

### Screen Readers

- [NVDA (Windows, Free)](https://www.nvaccess.org/)
- [JAWS (Windows, Paid)](https://www.freedomscientific.com/products/software/jaws/)
- [VoiceOver (macOS/iOS, Built-in)](https://www.apple.com/accessibility/voiceover/)

---

**Last Updated**: 2025-10-08
**Standard**: WAI-ARIA 1.2
**Maintained By**: VitalCV Development Team
