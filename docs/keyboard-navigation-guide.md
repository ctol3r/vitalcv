# Keyboard Navigation Guide

Complete guide for implementing keyboard accessibility in VitalCV.

## Overview

All functionality must be accessible via keyboard for WCAG 2.1 AA compliance.

**Key Principles:**
1. **Tab**: Navigate between focusable elements
2. **Enter/Space**: Activate buttons and links
3. **Arrow keys**: Navigate within components (menus, tabs, etc.)
4. **Escape**: Close modals and dropdowns

---

## Quick Reference

| Pattern | Keys | Behavior |
|---------|------|----------|
| Button | `Enter`, `Space` | Activate |
| Link | `Enter` | Navigate |
| Checkbox | `Space` | Toggle |
| Radio | `Arrow keys` | Select option |
| Dropdown | `Enter`/`Space` to open, `Arrow keys` to navigate, `Escape` to close | Navigate options |
| Modal | `Escape` to close | Focus trap active |
| Tabs | `Arrow keys` to navigate, `Enter`/`Space` to select | Roving tabindex |
| Menu | `Arrow keys` to navigate, `Enter` to select, `Escape` to close | Roving tabindex |

---

## Focus Management

### useFocusTrap

Trap focus within a modal or dropdown:

```typescript
import { useFocusTrap } from '@/lib/hooks/use-focus-management'

function Dialog({ isOpen }: { isOpen: boolean }) {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen)

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true">
      <h2>Dialog Title</h2>
      <button>Action</button>
      <button>Cancel</button>
    </div>
  )
}
```

### useFocusReturn

Return focus after closing a modal:

```typescript
import { useFocusReturn } from '@/lib/hooks/use-focus-management'

function Modal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const restoreFocus = useFocusReturn(isOpen)

  const handleClose = () => {
    onClose()
    restoreFocus() // Returns focus to trigger element
  }

  return <div>...</div>
}
```

### useAutoFocus

Auto-focus an element on mount:

```typescript
import { useAutoFocus } from '@/lib/hooks/use-focus-management'

function Dialog() {
  const closeButtonRef = useAutoFocus<HTMLButtonElement>()

  return (
    <div role="dialog">
      <button ref={closeButtonRef}>Close</button>
    </div>
  )
}
```

---

## Roving Tabindex

For components with multiple focusable items (toolbars, tabs, menus):

```typescript
import { useRovingTabIndex } from '@/lib/hooks/use-focus-management'

function Toolbar({ items }: { items: string[] }) {
  const [focusedIndex, setFocusedIndex, handleKeyDown] = useRovingTabIndex(
    items.length,
    'horizontal'
  )

  return (
    <div role="toolbar" onKeyDown={handleKeyDown}>
      {items.map((item, index) => (
        <button
          key={index}
          tabIndex={focusedIndex === index ? 0 : -1}
          onFocus={() => setFocusedIndex(index)}
        >
          {item}
        </button>
      ))}
    </div>
  )
}
```

---

## Keyboard Handlers

### useKeyboardNav

Handle keyboard events:

```typescript
import { useKeyboardNav } from '@/lib/hooks/use-focus-management'

function Dropdown() {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const handleKeyDown = useKeyboardNav({
    onEnter: () => selectItem(selectedIndex),
    onEscape: () => closeDropdown(),
    onArrowDown: () => setSelectedIndex(i => Math.min(i + 1, items.length - 1)),
    onArrowUp: () => setSelectedIndex(i => Math.max(i - 1, 0)),
    onHome: () => setSelectedIndex(0),
    onEnd: () => setSelectedIndex(items.length - 1),
  })

  return <div onKeyDown={handleKeyDown}>...</div>
}
```

---

## Component Patterns

### Button

```typescript
<button
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }}
>
  Click me
</button>
```

### Custom Checkbox

```typescript
<div
  role="checkbox"
  aria-checked={checked}
  tabIndex={0}
  onClick={() => setChecked(!checked)}
  onKeyDown={(e) => {
    if (e.key === ' ') {
      e.preventDefault()
      setChecked(!checked)
    }
  }}
>
  {checked ? '☑' : '☐'} Label
</div>
```

### Tabs

```typescript
function Tabs() {
  const [activeTab, setActiveTab] = useState(0)
  const [focusedIndex, setFocusedIndex, handleKeyDown] = useRovingTabIndex(tabs.length)

  return (
    <div>
      <div role="tablist" onKeyDown={handleKeyDown}>
        {tabs.map((tab, index) => (
          <button
            key={index}
            role="tab"
            aria-selected={activeTab === index}
            aria-controls={`panel-${index}`}
            tabIndex={focusedIndex === index ? 0 : -1}
            onClick={() => setActiveTab(index)}
            onFocus={() => setFocusedIndex(index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <div
          key={index}
          role="tabpanel"
          id={`panel-${index}`}
          hidden={activeTab !== index}
          tabIndex={0}
        >
          {tab.content}
        </div>
      ))}
    </div>
  )
}
```

### Modal/Dialog

```typescript
function Modal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen)
  const restoreFocus = useFocusReturn(isOpen)

  const handleClose = () => {
    onClose()
    restoreFocus()
  }

  const handleKeyDown = useKeyboardNav({
    onEscape: handleClose,
  })

  if (!isOpen) return null

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      onKeyDown={handleKeyDown}
    >
      <h2 id="dialog-title">Dialog Title</h2>
      <p>Content</p>
      <button onClick={handleClose}>Close</button>
    </div>
  )
}
```

### Dropdown Menu

```typescript
function DropdownMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex, handleKeyDown] = useRovingTabIndex(
    items.length,
    'vertical'
  )

  const menuRef = useFocusTrap<HTMLDivElement>(isOpen)

  return (
    <div>
      <button
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        Menu
      </button>
      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false)
            } else {
              handleKeyDown(e)
            }
          }}
        >
          {items.map((item, index) => (
            <button
              key={index}
              role="menuitem"
              tabIndex={focusedIndex === index ? 0 : -1}
              onFocus={() => setFocusedIndex(index)}
              onClick={() => {
                handleSelect(item)
                setIsOpen(false)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

## Focus Indicators

### Default Focus Ring

```css
/* All focusable elements */
button:focus,
a:focus,
input:focus {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

### Focus Visible (Keyboard Only)

```typescript
import { useFocusVisible } from '@/lib/hooks/use-focus-management'

function App() {
  useFocusVisible()
  return <div>...</div>
}
```

```css
/* Only show focus ring for keyboard navigation */
button[data-focus-visible] {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* Hide default focus ring */
button:focus:not([data-focus-visible]) {
  outline: none;
}
```

---

## Skip Links

Allow keyboard users to skip navigation:

```typescript
import { SkipLink } from '@/components/accessibility/skip-link'

export default function Layout({ children }) {
  return (
    <html>
      <body>
        <SkipLink />
        <header>
          <nav>{/* Navigation */}</nav>
        </header>
        <main id="main-content">
          {children}
        </main>
      </body>
    </html>
  )
}
```

---

## Testing Keyboard Navigation

### Manual Testing Checklist

- [ ] **Tab through all interactive elements**
  - All buttons, links, and form fields are reachable
  - Tab order follows visual order
  - No focus traps (except modals)

- [ ] **Enter/Space activates buttons**
  - All buttons respond to Enter and Space
  - Links respond to Enter

- [ ] **Arrow keys work in complex widgets**
  - Tabs navigate with arrows
  - Dropdowns navigate with arrows
  - Radio groups navigate with arrows

- [ ] **Escape closes modals and dropdowns**
  - Modals close with Escape
  - Dropdowns close with Escape
  - Focus returns to trigger

- [ ] **Focus indicators are visible**
  - All focused elements have visible indicator
  - Contrast ratio ≥ 3:1

- [ ] **No keyboard traps**
  - Can exit all components with keyboard
  - Modal trap releases on close

### Automated Testing

```typescript
import { testKeyboardNavigation } from '@/lib/test-utils/accessibility'

test('all elements are keyboard accessible', async () => {
  const { container } = render(<Component />)
  const navInfo = await testKeyboardNavigation(container)

  expect(navInfo.focusableElements.length).toBeGreaterThan(0)
  expect(navInfo.tabOrder).toMatchSnapshot()
})
```

---

## Common Issues & Fixes

### Issue: Can't tab to custom element

```typescript
// ❌ Bad - not focusable
<div onClick={handleClick}>Click me</div>

// ✅ Good - focusable
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }}
>
  Click me
</div>

// ✅ Better - use semantic HTML
<button onClick={handleClick}>Click me</button>
```

### Issue: Focus indicator not visible

```css
/* ❌ Bad - removes focus indicator */
button:focus {
  outline: none;
}

/* ✅ Good - custom focus indicator */
button:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

### Issue: Modal doesn't trap focus

```typescript
// ❌ Bad - no focus trap
function Modal() {
  return <div role="dialog">...</div>
}

// ✅ Good - focus trap enabled
import { useFocusTrap } from '@/lib/hooks/use-focus-management'

function Modal() {
  const dialogRef = useFocusTrap(true)
  return <div ref={dialogRef} role="dialog">...</div>
}
```

### Issue: Focus lost after closing modal

```typescript
// ❌ Bad - focus not restored
function Modal({ onClose }) {
  return <button onClick={onClose}>Close</button>
}

// ✅ Good - focus restored
import { useFocusReturn } from '@/lib/hooks/use-focus-management'

function Modal({ onClose }) {
  const restoreFocus = useFocusReturn(true)

  const handleClose = () => {
    onClose()
    restoreFocus()
  }

  return <button onClick={handleClose}>Close</button>
}
```

---

## Resources

- [Keyboard Navigation WCAG](https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Keyboard Testing](https://webaim.org/articles/keyboard/)

---

**Last Updated**: 2025-10-08
**Standard**: WCAG 2.1 AA
**Maintained By**: VitalCV Development Team
