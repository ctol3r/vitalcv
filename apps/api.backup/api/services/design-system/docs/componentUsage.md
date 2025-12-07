# Component Usage Guidelines

This document provides comprehensive guidelines for using design system components, including when to use each component, best practices, accessibility considerations, and examples.

## Table of Contents

- [Button](#button)
- [Card](#card)
- [Input](#input)
- [Dialog](#dialog)
- [Select](#select)
- [Checkbox](#checkbox)
- [Switch](#switch)
- [Tabs](#tabs)
- [Tooltip](#tooltip)
- [Badge](#badge)

---

## Button

### When to Use

- Primary actions that move users forward in a flow
- Secondary actions that provide alternative options
- Destructive actions that require confirmation
- Navigation links styled as buttons

### When NOT to Use

- For navigation between pages (use Link component instead)
- For icon-only actions without labels (consider IconButton)
- For actions that are not interactive

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'destructive' \| 'outline' \| 'secondary' \| 'ghost' \| 'link'` | `'default'` | Visual style variant |
| `size` | `'default' \| 'sm' \| 'lg' \| 'icon'` | `'default'` | Size of the button |
| `asChild` | `boolean` | `false` | Render as child component |
| `disabled` | `boolean` | `false` | Disable button interaction |
| `className` | `string` | - | Additional CSS classes |

### Variants

#### Default
Primary actions, main CTAs.

```tsx
<Button variant="default">Save Changes</Button>
```

#### Destructive
Delete, remove, or destructive actions.

```tsx
<Button variant="destructive">Delete Account</Button>
```

#### Outline
Secondary actions, less emphasis.

```tsx
<Button variant="outline">Cancel</Button>
```

#### Secondary
Alternative actions with medium emphasis.

```tsx
<Button variant="secondary">Learn More</Button>
```

#### Ghost
Subtle actions, minimal visual weight.

```tsx
<Button variant="ghost">View Details</Button>
```

#### Link
Text-style button for navigation-like actions.

```tsx
<Button variant="link">Read More</Button>
```

### Accessibility Considerations

- ✅ Always provide accessible labels for icon-only buttons
- ✅ Use `aria-label` when text is not descriptive enough
- ✅ Ensure sufficient color contrast (WCAG AA minimum)
- ✅ Provide focus indicators
- ✅ Disabled buttons should be clearly indicated

### Do's and Don'ts

**Do:**
- Use descriptive button text
- Group related buttons together
- Provide loading states for async actions
- Use appropriate variant for action importance

**Don't:**
- Use buttons for navigation (use Link)
- Create buttons that are too small to click
- Use destructive variant without confirmation
- Nest interactive elements inside buttons

---

## Card

### When to Use

- Grouping related content
- Displaying information in containers
- Creating distinct sections on a page
- Building dashboard widgets

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### Sub-components

- `CardHeader` - Container for title and description
- `CardTitle` - Main heading
- `CardDescription` - Supporting text
- `CardContent` - Main content area
- `CardFooter` - Footer actions or metadata
- `CardAction` - Action buttons in header

### Example

```tsx
<Card>
  <CardHeader>
    <CardTitle>User Profile</CardTitle>
    <CardDescription>Manage your account settings</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
  <CardFooter>
    <Button>Save</Button>
  </CardFooter>
</Card>
```

### Accessibility Considerations

- ✅ Use semantic HTML structure
- ✅ Ensure proper heading hierarchy
- ✅ Provide sufficient color contrast
- ✅ Use landmarks when appropriate

---

## Input

### When to Use

- Text input fields
- Form data collection
- Search inputs
- Number inputs

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `string` | `'text'` | Input type (text, email, password, etc.) |
| `placeholder` | `string` | - | Placeholder text |
| `disabled` | `boolean` | `false` | Disable input |
| `required` | `boolean` | `false` | Mark as required |
| `className` | `string` | - | Additional CSS classes |

### Accessibility Considerations

- ✅ Always pair with Label component
- ✅ Provide error messages with `aria-describedby`
- ✅ Use appropriate input types
- ✅ Ensure placeholder text is not the only label
- ✅ Provide autocomplete attributes when applicable

### Example

```tsx
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    placeholder="you@example.com"
    required
    aria-describedby="email-error"
  />
  <p id="email-error" className="text-sm text-destructive">
    {error}
  </p>
</div>
```

---

## Dialog

### When to Use

- Confirmation dialogs
- Forms in overlays
- Detailed information display
- Critical user decisions

### When NOT to Use

- For non-blocking information (use Toast)
- For simple confirmations (consider AlertDialog)
- For navigation (use Sheet or Drawer)

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | `false` | Control dialog visibility |
| `onOpenChange` | `(open: boolean) => void` | - | Callback when open state changes |

### Accessibility Considerations

- ✅ Trap focus within dialog
- ✅ Return focus to trigger on close
- ✅ Provide close button
- ✅ Use appropriate ARIA roles
- ✅ Support Escape key to close
- ✅ Prevent background scrolling

### Example

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Action</DialogTitle>
      <DialogDescription>
        Are you sure you want to proceed?
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleConfirm}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Select

### When to Use

- Dropdown selections
- Single choice from multiple options
- Form field selections
- Filter options

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | Selected value |
| `onValueChange` | `(value: string) => void` | - | Change handler |
| `disabled` | `boolean` | `false` | Disable select |

### Accessibility Considerations

- ✅ Always pair with Label
- ✅ Provide clear option labels
- ✅ Support keyboard navigation
- ✅ Announce selection changes to screen readers

### Example

```tsx
<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select an option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

---

## Checkbox

### When to Use

- Multiple selections
- Boolean toggles
- Agreement checkboxes
- Filter selections

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `checked` | `boolean` | `false` | Checked state |
| `onCheckedChange` | `(checked: boolean) => void` | - | Change handler |
| `disabled` | `boolean` | `false` | Disable checkbox |

### Accessibility Considerations

- ✅ Always pair with Label
- ✅ Use `aria-describedby` for additional context
- ✅ Support keyboard interaction (Space to toggle)
- ✅ Provide clear visual feedback

---

## Switch

### When to Use

- On/off toggles
- Feature enable/disable
- Settings preferences
- Real-time state changes

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `checked` | `boolean` | `false` | Checked state |
| `onCheckedChange` | `(checked: boolean) => void` | - | Change handler |
| `disabled` | `boolean` | `false` | Disable switch |

### Accessibility Considerations

- ✅ Always pair with Label
- ✅ Use `aria-label` if label is not descriptive
- ✅ Provide clear on/off states
- ✅ Support keyboard interaction

---

## Tabs

### When to Use

- Organizing related content
- Switching between views
- Grouping information
- Navigation within a page

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `defaultValue` | `string` | - | Default active tab |
| `value` | `string` | - | Controlled active tab |
| `onValueChange` | `(value: string) => void` | - | Change handler |

### Accessibility Considerations

- ✅ Use proper ARIA roles
- ✅ Support keyboard navigation (Arrow keys)
- ✅ Provide accessible labels
- ✅ Indicate active tab clearly

---

## Tooltip

### When to Use

- Additional context
- Helpful hints
- Icon explanations
- Short descriptions

### When NOT to Use

- For critical information (use Alert)
- For long content (use Popover)
- For interactive content (use Popover)

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `ReactNode` | - | Tooltip content |
| `side` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'top'` | Position |

### Accessibility Considerations

- ✅ Provide alternative text for icon-only triggers
- ✅ Ensure tooltip is keyboard accessible
- ✅ Don't rely solely on tooltips for critical information

---

## Badge

### When to Use

- Status indicators
- Counts and labels
- Categorization
- Small metadata

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'secondary' \| 'destructive' \| 'outline'` | `'default'` | Visual variant |

### Example

```tsx
<Badge variant="default">New</Badge>
<Badge variant="secondary">Draft</Badge>
<Badge variant="destructive">Error</Badge>
```

---

## General Best Practices

### Component Composition

- Use sub-components for complex structures
- Compose smaller components into larger ones
- Follow the single responsibility principle

### Styling

- Use design tokens for spacing, colors, and typography
- Prefer className over inline styles
- Use variant props for different styles
- Maintain consistency across components

### Performance

- Lazy load heavy components
- Memoize expensive computations
- Use React.memo for pure components
- Optimize re-renders with proper dependencies

### Testing

- Test accessibility with screen readers
- Test keyboard navigation
- Test responsive behavior
- Test error states and edge cases

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-16 | Initial component usage guidelines |

