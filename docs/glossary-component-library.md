# Component Library Foundations - Glossary

**Version**: 1.0.0
**Last Updated**: 2025-10-08
**Related Tasks**: VFE-0001 to VFE-0020

---

## Overview

This glossary defines the foundational UI components for the VitalCV design system. All components follow **WCAG 2.1 AA accessibility standards**, support **dark mode**, and use **Radix UI primitives** with **Tailwind CSS** styling.

---

## 1. Button (VFE-0001)

**Definition**: A clickable interactive element that triggers an action or navigation when activated.

**Synonyms**: Action Button, CTA (Call-to-Action), Click Button, Push Button

**Technical Implementation**:
- Base: `<button>` element or Radix UI `<Slot>` for composition
- Variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
- Sizes: `default` (h-9), `sm` (h-8), `lg` (h-10), `icon` (size-9)
- Uses CVA (class-variance-authority) for variant management

**Usage Patterns**:
```tsx
// Primary action
<Button>Submit Form</Button>

// Destructive action with confirmation
<Button variant="destructive">Delete Credential</Button>

// Icon button
<Button variant="ghost" size="icon"><Menu /></Button>
```

**Accessibility Requirements**:
- Must have accessible label (text or `aria-label`)
- Keyboard accessible (focusable, activates on Enter/Space)
- Visible focus indicator (`focus-visible:ring`)
- Disabled state clearly indicated (`disabled:opacity-50`)
- Loading state with `aria-busy="true"`

**Design System Notes**:
- Default variant has primary brand color background
- Ghost variant for subtle actions
- Icon buttons must be size-9 (36x36px) minimum for touch targets
- All buttons have 3px focus ring with ring color

---

## 2. Card (VFE-0002)

**Definition**: A container component that groups related content and actions in a visually distinct, bordered surface.

**Synonyms**: Panel, Container, Surface, Widget, Module

**Technical Implementation**:
- Composition: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `CardAction`
- Base styling: rounded-xl border, shadow-sm, padding py-6
- Uses `data-slot` attributes for nested component targeting

**Usage Patterns**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Credential Status</CardTitle>
    <CardDescription>View verification details</CardDescription>
    <CardAction><Button variant="ghost">...</Button></CardAction>
  </CardHeader>
  <CardContent>
    {/* Main content */}
  </CardContent>
  <CardFooter>
    {/* Actions */}
  </CardFooter>
</Card>
```

**Accessibility Requirements**:
- Optional `role="region"` with `aria-label` for landmark navigation
- Heading hierarchy maintained (CardTitle should use appropriate heading level)
- Sufficient color contrast for borders and text
- Interactive elements within card must be keyboard accessible

**Design System Notes**:
- Cards use semantic `bg-card` and `text-card-foreground` tokens
- Gap-6 between sections for consistent spacing
- Border in dark mode uses subtle contrast
- Can nest cards but avoid more than 2 levels deep

---

## 3. Input (VFE-0003)

**Definition**: A form control that allows users to enter single-line text data.

**Synonyms**: Text Field, Text Input, Form Field, Text Box

**Technical Implementation**:
- Base: `<input type="text">` element
- Variants support: text, email, password, number, tel, url, search
- Integrated with React Hook Form via Field component
- Zod validation for schema-based validation

**Usage Patterns**:
```tsx
// Standalone
<Input placeholder="Enter email" type="email" />

// With Field wrapper (preferred)
<Field label="Email Address" required>
  <Input type="email" />
</Field>
```

**Accessibility Requirements**:
- Must have associated `<label>` or `aria-label`
- Invalid state indicated with `aria-invalid="true"`
- Error messages linked with `aria-describedby`
- Type attribute matches expected input format
- Autocomplete attributes for common fields (`autocomplete="email"`)

**Design System Notes**:
- Height: h-9 (36px) minimum
- Border: 1px with rounded corners
- Focus: 3px ring with ring color
- Invalid state: red border with destructive ring
- Disabled: reduced opacity with pointer-events-none

---

## 4. Badge (VFE-0004)

**Definition**: A small status indicator or label that displays metadata, categories, or state information.

**Synonyms**: Tag, Label, Chip, Status Indicator, Pill

**Technical Implementation**:
- Base: `<div>` or `<span>` element
- Variants: `default`, `secondary`, `destructive`, `outline`
- Compact design with small text size and padding

**Usage Patterns**:
```tsx
// Status badge
<Badge variant="default">Active</Badge>

// Destructive state
<Badge variant="destructive">Revoked</Badge>

// Count badge
<Badge variant="secondary">{count}</Badge>
```

**Accessibility Requirements**:
- Text must have sufficient contrast (4.5:1 minimum)
- Don't rely solely on color to convey meaning
- Use `aria-label` if badge icon-only
- For status badges, consider `role="status"` for live regions

**Design System Notes**:
- Capitalize text: `capitalize` utility class
- Use semantic colors for status (green=valid, red=revoked, gray=unknown)
- Small size: text-xs with minimal padding
- Can be used inline or standalone

---

## 5. Alert (VFE-0005)

**Definition**: A notification component that displays important information, warnings, or errors to the user.

**Synonyms**: Notification, Banner, Message, Info Box, Warning Box

**Technical Implementation**:
- Composition: `Alert`, `AlertDescription`, `AlertTitle`
- Variants: `default`, `destructive`
- Typically includes an icon for visual context

**Usage Patterns**:
```tsx
<Alert>
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Verification Failed</AlertTitle>
  <AlertDescription>
    The credential could not be verified. Please check the ID and try again.
  </AlertDescription>
</Alert>
```

**Accessibility Requirements**:
- Use `role="alert"` for urgent messages (announces to screen readers)
- Use `role="status"` for non-urgent notifications
- Icon should be `aria-hidden="true"` (redundant with text)
- Sufficient color contrast for all variants
- Dismissible alerts need accessible close button

**Design System Notes**:
- Default variant: neutral blue/gray background
- Destructive variant: red background for errors
- Padding: p-4 with rounded corners
- Can be used inline or as toast notifications

---

## 6. Dialog (VFE-0006)

**Definition**: A modal overlay component that displays content above the main page, requiring user interaction before returning to the main interface.

**Synonyms**: Modal, Overlay, Popup, Lightbox, Modal Dialog

**Technical Implementation**:
- Base: Radix UI Dialog primitive
- Composition: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`
- Portal rendering for proper z-index stacking
- Focus trap when open

**Usage Patterns**:
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Action</DialogTitle>
      <DialogDescription>This action cannot be undone.</DialogDescription>
    </DialogHeader>
    {/* Content */}
    <DialogFooter>
      <Button variant="outline" onClick={onCancel}>Cancel</Button>
      <Button onClick={onConfirm}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Accessibility Requirements**:
- DialogTitle required (uses `aria-labelledby`)
- DialogDescription provides additional context (`aria-describedby`)
- Focus automatically moved to dialog when opened
- Escape key closes dialog
- Focus returned to trigger element on close
- Background content inert when dialog open
- Close button must be keyboard accessible

**Design System Notes**:
- Backdrop overlay with semi-transparent background
- Content centered on screen with max-width constraint
- Animation: fade in/out with scale transform
- Mobile: full-screen on small viewports
- Z-index: 50 (modal layer)

---

## 7. Form Field (VFE-0007)

**Definition**: A composite component that wraps input controls with labels, validation messages, and helper text.

**Synonyms**: Field Wrapper, Form Group, Input Group, Form Control

**Technical Implementation**:
- Composition: Label + Input/Control + Error Message + Helper Text
- Integrates with React Hook Form for validation
- Zod schema validation support

**Usage Patterns**:
```tsx
<Field
  label="Email Address"
  required
  error={errors.email?.message}
  helperText="We'll never share your email"
>
  <Input type="email" {...register("email")} />
</Field>
```

**Accessibility Requirements**:
- Label properly associated with input (for/id or nested)
- Required fields indicated visually and with `aria-required="true"`
- Error messages linked with `aria-describedby`
- Helper text doesn't replace label
- Field group uses semantic HTML structure

**Design System Notes**:
- Vertical spacing: gap-1.5 between label and input
- Error messages in destructive color
- Required indicator: red asterisk after label
- Helper text in muted color (text-muted-foreground)

---

## 8. Select (VFE-0008)

**Definition**: A dropdown control that allows users to choose one option from a list.

**Synonyms**: Dropdown, Picker, Combobox, Choice List

**Technical Implementation**:
- Base: Radix UI Select primitive
- Composition: `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel`
- Portal rendering for dropdown content
- Keyboard navigation support

**Usage Patterns**:
```tsx
<Select onValueChange={setValue} defaultValue={value}>
  <SelectTrigger>
    <SelectValue placeholder="Select credential type" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="license">Medical License</SelectItem>
    <SelectItem value="npi">NPI Number</SelectItem>
    <SelectItem value="board-cert">Board Certification</SelectItem>
  </SelectContent>
</Select>
```

**Accessibility Requirements**:
- Trigger has `aria-expanded` state
- Options have `role="option"`
- Selected option indicated with `aria-selected="true"`
- Keyboard navigation: Arrow keys, Home/End, typing to filter
- Disabled options: `aria-disabled="true"`
- Label associated with trigger

**Design System Notes**:
- Trigger styled like input field for consistency
- Dropdown content with shadow and border
- Hover and focus states for items
- Checkmark icon for selected item
- Max height with scroll for long lists

---

## 9. Checkbox (VFE-0009)

**Definition**: A binary control that allows users to select or deselect an option.

**Synonyms**: Checkmark, Toggle Box, Selection Box, Tick Box

**Technical Implementation**:
- Base: Radix UI Checkbox primitive
- Composition: `Checkbox` + `Label`
- Indeterminate state support for parent-child relationships

**Usage Patterns**:
```tsx
<div className="flex items-center space-x-2">
  <Checkbox id="terms" checked={agreed} onCheckedChange={setAgreed} />
  <Label htmlFor="terms">I agree to terms and conditions</Label>
</div>
```

**Accessibility Requirements**:
- Label associated with checkbox (for/id)
- `role="checkbox"` with `aria-checked` state
- Keyboard accessible (Space to toggle)
- Visible focus indicator
- Disabled state clearly indicated
- Group of checkboxes in `<fieldset>` with `<legend>`

**Design System Notes**:
- Size: 16x16px minimum (20x20px preferred)
- Border: 1.5px solid
- Checked state: primary color fill with white checkmark
- Indeterminate: dash icon instead of checkmark
- Focus: 3px ring

---

## 10. Radio Group (VFE-0010)

**Definition**: A set of mutually exclusive options where only one can be selected at a time.

**Synonyms**: Radio Buttons, Option Group, Single Choice, Radio Set

**Technical Implementation**:
- Base: Radix UI RadioGroup primitive
- Composition: `RadioGroup`, `RadioGroupItem` + `Label`
- Single selection enforced

**Usage Patterns**:
```tsx
<RadioGroup value={value} onValueChange={setValue}>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="full" id="full" />
    <Label htmlFor="full">Full Disclosure</Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="selective" id="selective" />
    <Label htmlFor="selective">Selective Disclosure</Label>
  </div>
</RadioGroup>
```

**Accessibility Requirements**:
- Group wrapped in `<fieldset>` with `<legend>`
- `role="radiogroup"` on container
- Each option: `role="radio"` with `aria-checked` state
- Arrow keys navigate between options
- Space selects focused option
- Labels properly associated

**Design System Notes**:
- Circular indicator (not square like checkbox)
- Size: 16x16px minimum
- Checked state: outer ring + inner filled circle
- Vertical or horizontal layout depending on space
- Focus: 3px ring on active item

---

## 11. Toast (VFE-0011)

**Definition**: A temporary, non-blocking notification that appears briefly to provide feedback on user actions.

**Synonyms**: Snackbar, Notification, Flash Message, Temporary Alert

**Technical Implementation**:
- Base: Radix UI Toast or Sonner library
- Composition: `Toast`, `ToastAction`, `ToastDescription`, `ToastTitle`
- Auto-dismiss with configurable duration
- Queue management for multiple toasts

**Usage Patterns**:
```tsx
const { toast } = useToast()

toast({
  title: "Credential Verified",
  description: "The credential is valid and active",
  variant: "default"
})

toast({
  title: "Error",
  description: "Failed to verify credential",
  variant: "destructive"
})
```

**Accessibility Requirements**:
- `role="status"` or `role="alert"` depending on urgency
- Screen reader announces content
- Focus management doesn't interrupt user flow
- Dismiss button keyboard accessible
- Sufficient time to read (minimum 5 seconds or based on content length)

**Design System Notes**:
- Position: bottom-right (desktop), bottom-center (mobile)
- Animation: slide in from bottom
- Max width: 420px
- Auto-dismiss: 5 seconds default
- Variants: default, destructive, success
- Can include action button

---

## 12. Skeleton (VFE-0012)

**Definition**: A placeholder component that displays a loading state while content is being fetched.

**Synonyms**: Loading Placeholder, Content Loader, Shimmer, Ghost Loading

**Technical Implementation**:
- Base: `<div>` with animated gradient background
- Variants match shape of content being loaded (text, circle, rectangle)
- Pulse animation

**Usage Patterns**:
```tsx
// Text skeleton
<Skeleton className="h-4 w-full" />

// Avatar skeleton
<Skeleton className="h-12 w-12 rounded-full" />

// Card skeleton
<Card>
  <CardHeader>
    <Skeleton className="h-6 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
  </CardHeader>
  <CardContent>
    <Skeleton className="h-32 w-full" />
  </CardContent>
</Card>
```

**Accessibility Requirements**:
- `aria-busy="true"` on parent container
- `aria-live="polite"` region announces when content loads
- Don't use skeleton for critical loading states (use text instead)
- Screen reader text: "Loading..."

**Design System Notes**:
- Background: muted color with subtle animation
- Animation: pulse or shimmer effect
- Match dimensions of actual content
- Rounded corners match final content
- Don't animate too fast (avoid seizure triggers)

---

## 13. Accordion (VFE-0013)

**Definition**: A vertically stacked set of collapsible panels that show/hide content sections.

**Synonyms**: Collapsible Panel, Expandable List, Disclosure Widget

**Technical Implementation**:
- Base: Radix UI Accordion primitive
- Types: `single` (one open at a time) or `multiple` (multiple can be open)
- Composition: `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`

**Usage Patterns**:
```tsx
<Accordion type="single" collapsible>
  <AccordionItem value="item-1">
    <AccordionTrigger>What is a Verifiable Credential?</AccordionTrigger>
    <AccordionContent>
      A Verifiable Credential is a tamper-evident credential...
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="item-2">
    <AccordionTrigger>How do I verify a credential?</AccordionTrigger>
    <AccordionContent>
      To verify a credential, enter the credential ID...
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

**Accessibility Requirements**:
- Trigger has `role="button"` and `aria-expanded` state
- Content has `role="region"` labeled by trigger
- Keyboard: Enter/Space toggles, Arrow keys navigate triggers
- Focus indicator on trigger
- Animated transitions don't cause motion sickness (respect prefers-reduced-motion)

**Design System Notes**:
- Border between items for visual separation
- Chevron icon indicates expand/collapse state
- Smooth animation for content show/hide
- Content has padding for readability
- Trigger has hover and focus states

---

## 14. Tabs (VFE-0014)

**Definition**: A navigation component that organizes content into separate views, with only one visible at a time.

**Synonyms**: Tab Panel, Tabbed Interface, Tab Navigation, Segmented Control

**Technical Implementation**:
- Base: Radix UI Tabs primitive
- Composition: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- Supports horizontal and vertical orientation

**Usage Patterns**:
```tsx
<Tabs defaultValue="credentials">
  <TabsList>
    <TabsTrigger value="credentials">Credentials</TabsTrigger>
    <TabsTrigger value="activity">Activity</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>
  <TabsContent value="credentials">
    {/* Credentials content */}
  </TabsContent>
  <TabsContent value="activity">
    {/* Activity content */}
  </TabsContent>
  <TabsContent value="settings">
    {/* Settings content */}
  </TabsContent>
</Tabs>
```

**Accessibility Requirements**:
- TabsList has `role="tablist"`
- Each trigger has `role="tab"` with `aria-selected` state
- Content has `role="tabpanel"` labeled by corresponding tab
- Keyboard: Arrow keys navigate tabs, Tab key moves to content
- Focus indicator on active tab
- Active panel announced by screen readers

**Design System Notes**:
- TabsList styled as horizontal pill group or underline style
- Active tab has distinct visual state (underline or background)
- Inactive tabs have reduced opacity
- Content area has padding
- Responsive: may convert to dropdown on mobile

---

## 15. Progress (VFE-0015)

**Definition**: An indicator that shows the completion status of a task or process.

**Synonyms**: Progress Bar, Loading Bar, Progress Indicator, Completion Bar

**Technical Implementation**:
- Base: Radix UI Progress primitive or native `<progress>` element
- Determinate (known progress) or indeterminate (unknown duration)
- Value range: 0-100 (percentage)

**Usage Patterns**:
```tsx
// Determinate progress
<Progress value={progress} max={100} />

// With label
<div>
  <div className="flex justify-between mb-2">
    <Label>Upload Progress</Label>
    <span className="text-sm text-muted-foreground">{progress}%</span>
  </div>
  <Progress value={progress} />
</div>
```

**Accessibility Requirements**:
- `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- For indeterminate: omit aria-valuenow
- Label or `aria-label` describes what's progressing
- `aria-live="polite"` region announces progress updates (throttled)

**Design System Notes**:
- Height: 8-12px typical
- Background: muted color
- Fill: primary color
- Rounded ends for modern look
- Animate fill changes smoothly
- For indeterminate: animated gradient or pulsing

---

## 16. Avatar (VFE-0016)

**Definition**: A circular or rounded component that displays a user's profile image, initials, or icon.

**Synonyms**: Profile Picture, User Image, Profile Icon, User Avatar

**Technical Implementation**:
- Base: Radix UI Avatar primitive
- Composition: `Avatar`, `AvatarImage`, `AvatarFallback`
- Fallback shows initials or icon if image fails to load

**Usage Patterns**:
```tsx
<Avatar>
  <AvatarImage src={user.imageUrl} alt={user.name} />
  <AvatarFallback>{user.initials}</AvatarFallback>
</Avatar>

// With size variants
<Avatar className="h-8 w-8"> {/* Small */}
<Avatar className="h-12 w-12"> {/* Medium (default) */}
<Avatar className="h-16 w-16"> {/* Large */}
```

**Accessibility Requirements**:
- Image has descriptive `alt` text with user's name
- Fallback is readable (sufficient contrast)
- Not used as interactive element (wrap in button if clickable)
- Decorative avatars can have `alt=""` or `aria-hidden="true"`

**Design System Notes**:
- Circular shape: `rounded-full`
- Common sizes: 32px (sm), 40px (md), 48px (lg), 64px (xl)
- Fallback background: primary or muted color
- Fallback text: 1-2 initials in uppercase
- Border optional for contrast on light backgrounds

---

## 17. Breadcrumb (VFE-0017)

**Definition**: A navigation element that shows the user's current location within the site hierarchy.

**Synonyms**: Breadcrumb Trail, Navigation Path, Location Indicator

**Technical Implementation**:
- Composition: `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbSeparator`, `BreadcrumbPage`
- Uses semantic HTML with `<nav>` element
- Structured data for SEO

**Usage Patterns**:
```tsx
<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/">Home</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink href="/credentials">Credentials</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>Verification</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

**Accessibility Requirements**:
- Wrapped in `<nav aria-label="Breadcrumb">`
- Current page has `aria-current="page"`
- Separators are decorative (`aria-hidden="true"`)
- Links are keyboard accessible
- Screen reader announces full path

**Design System Notes**:
- Separator: chevron or slash icon
- Current page: not a link, different color
- Text size: text-sm
- Truncate long paths: show first, ..., last two items
- Mobile: may show only current and back link

---

## 18. Dropdown Menu (VFE-0018)

**Definition**: A contextual menu that displays a list of actions or options when triggered.

**Synonyms**: Context Menu, Action Menu, Popup Menu, Flyout Menu

**Technical Implementation**:
- Base: Radix UI DropdownMenu primitive
- Composition: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuLabel`, `DropdownMenuSub`
- Portal rendering
- Keyboard navigation

**Usage Patterns**:
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <MoreVertical className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuLabel>Actions</DropdownMenuLabel>
    <DropdownMenuItem onSelect={onEdit}>
      <Edit className="mr-2 h-4 w-4" />
      Edit
    </DropdownMenuItem>
    <DropdownMenuItem onSelect={onDuplicate}>
      <Copy className="mr-2 h-4 w-4" />
      Duplicate
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onSelect={onDelete} className="text-destructive">
      <Trash className="mr-2 h-4 w-4" />
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Accessibility Requirements**:
- Trigger has `aria-expanded` and `aria-haspopup="menu"`
- Menu has `role="menu"`, items have `role="menuitem"`
- Keyboard: Arrow keys navigate, Enter/Space selects, Esc closes
- Focus returns to trigger on close
- Disabled items: `aria-disabled="true"`

**Design System Notes**:
- Shadow and border for elevation
- Hover state on items
- Icons aligned to left of text
- Destructive actions in red
- Separators for grouping related actions
- Align: start, center, or end relative to trigger

---

## 19. Calendar (VFE-0019)

**Definition**: A date picker component that allows users to select dates from a visual calendar interface.

**Synonyms**: Date Picker, Date Selector, Calendar Widget, Date Input

**Technical Implementation**:
- Base: React Day Picker library
- Integration with form controls
- Range selection support
- Disabled dates configuration

**Usage Patterns**:
```tsx
<Calendar
  mode="single"
  selected={date}
  onSelect={setDate}
  disabled={(date) => date < new Date()}
  initialFocus
/>

// Range selection
<Calendar
  mode="range"
  selected={dateRange}
  onSelect={setDateRange}
  numberOfMonths={2}
/>
```

**Accessibility Requirements**:
- `role="application"` with `aria-label="Calendar"`
- Grid navigation with arrow keys
- Month/year navigation keyboard accessible
- Selected date announced by screen reader
- Date format configurable for internationalization
- Today's date clearly indicated

**Design System Notes**:
- Grid layout for days
- Previous/Next month navigation
- Today highlighted with distinct style
- Selected date: primary color background
- Disabled dates: reduced opacity, not selectable
- Range selection: start, middle, end styling
- Responsive: single month on mobile

---

## 20. Upload Dropzone (VFE-0020)

**Definition**: A file upload component that allows users to drag-and-drop files or click to browse.

**Synonyms**: File Upload, Drag-Drop Upload, File Picker, Upload Area

**Technical Implementation**:
- Base: react-dropzone library
- Multiple file support
- File type restrictions
- Size limit validation
- Preview for images

**Usage Patterns**:
```tsx
<UploadDropzone
  accept={{
    'application/pdf': ['.pdf'],
    'image/*': ['.png', '.jpg', '.jpeg']
  }}
  maxSize={10 * 1024 * 1024} // 10MB
  onDrop={handleDrop}
  multiple={false}
>
  <Upload className="h-8 w-8 mb-2" />
  <p>Drag & drop a file here, or click to select</p>
  <p className="text-xs text-muted-foreground">PDF or Image up to 10MB</p>
</UploadDropzone>
```

**Accessibility Requirements**:
- Hidden file input with label
- Keyboard accessible (Enter/Space opens file dialog)
- Drag-drop area has visible focus indicator
- Upload progress announced to screen readers
- Error messages linked with `aria-describedby`
- File list with remove buttons keyboard accessible

**Design System Notes**:
- Dashed border to indicate drop zone
- Hover/drag states with color change
- Icon + text for visual clarity
- File size and type restrictions shown
- Loading state during upload
- Success/error feedback with icons
- File preview thumbnails for images
- Remove button for each file

---

## Design System Principles

### Color System
- **Semantic tokens**: primary, destructive, secondary, accent, muted
- **Light/Dark mode**: All components support theme switching
- **Contrast**: WCAG AA minimum (4.5:1 for text, 3:1 for UI elements)

### Typography
- **Font family**: Geist (sans-serif)
- **Scale**: text-xs, text-sm, text-base, text-lg, text-xl
- **Weight**: font-normal, font-medium, font-semibold, font-bold

### Spacing
- **Scale**: 0.25rem increments (px-1 to px-12)
- **Gap**: gap-1, gap-2, gap-4, gap-6 for consistent spacing
- **Padding**: Consistent padding patterns (px-4, px-6)

### Accessibility
- **Keyboard navigation**: All interactive elements must be keyboard accessible
- **Focus indicators**: Visible 3px ring with ring color
- **Screen readers**: Proper ARIA labels, roles, and states
- **Color contrast**: WCAG 2.1 AA minimum (4.5:1 for text)
- **Touch targets**: Minimum 36x36px (44x44px preferred)

### Responsive Design
- **Mobile-first**: Start with mobile layout, enhance for larger screens
- **Breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px)
- **Touch-friendly**: Larger touch targets on mobile
- **Adaptive**: Components adapt to screen size (e.g., Dialog full-screen on mobile)

---

## Validation & Testing

### Component Checklist
- [ ] TypeScript interfaces defined
- [ ] Variants documented
- [ ] Accessibility requirements met
- [ ] Keyboard navigation tested
- [ ] Screen reader tested
- [ ] Dark mode support
- [ ] Responsive behavior verified
- [ ] Unit tests written
- [ ] Storybook story created
- [ ] Documentation updated

### Accessibility Testing
- [ ] Keyboard-only navigation works
- [ ] Screen reader announces correctly (NVDA, JAWS, VoiceOver)
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA
- [ ] Touch targets meet minimum size
- [ ] Forms properly labeled
- [ ] Error messages announced

### Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## References

- **Radix UI**: https://www.radix-ui.com/
- **Tailwind CSS**: https://tailwindcss.com/
- **WCAG 2.1**: https://www.w3.org/WAI/WCAG21/quickref/
- **ARIA Authoring Practices**: https://www.w3.org/WAI/ARIA/apg/

---

**Next Steps**: Create Storybook stories and unit tests for components without coverage (VFE-0002, VFE-0003, VFE-0004, etc.)
