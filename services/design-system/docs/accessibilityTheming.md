# Accessibility Theming Guide

**B246B-DES-015: AccessibilityThemingGuide**

This guide covers best practices for ensuring accessible themes in the design system, including color contrast, font size, spacing, and WCAG requirements.

## Table of Contents

1. [Color Contrast](#color-contrast)
2. [Font Size and Typography](#font-size-and-typography)
3. [Spacing and Layout](#spacing-and-layout)
4. [WCAG Requirements](#wcag-requirements)
5. [Examples](#examples)
6. [Testing](#testing)

## Color Contrast

### WCAG Contrast Requirements

The Web Content Accessibility Guidelines (WCAG) specify minimum contrast ratios for text:

- **WCAG AA (Level A)**:
  - Normal text (under 18pt): 4.5:1
  - Large text (18pt+ or 14pt+ bold): 3:1

- **WCAG AAA (Level AA)**:
  - Normal text: 7:1
  - Large text: 4.5:1

### Good Contrast Examples

✅ **Good Contrast (Passes WCAG AA)**
- Dark text (#111827) on light background (#ffffff) = 16.6:1
- Light text (#f9fafb) on dark background (#111827) = 16.6:1
- Blue accent (#3b82f6) on white = 4.5:1 (for large text)

❌ **Poor Contrast (Fails WCAG AA)**
- Light gray text (#d1d5db) on white background (#ffffff) = 2.1:1
- Medium gray text (#6b7280) on light gray background (#f3f4f6) = 3.2:1

### Color Roles and Contrast

When creating themes, ensure:

1. **Foreground on Background**: Minimum 4.5:1 for normal text
2. **Primary Actions**: High contrast (at least 4.5:1) for buttons and links
3. **Borders**: Sufficient contrast to be visible (at least 3:1)
4. **Focus Indicators**: High contrast (at least 3:1) and clearly visible

### Theme Color Mapping

```typescript
// Good contrast mapping
colors: {
  background: '#ffffff',        // Light background
  foreground: '#111827',         // Dark text (16.6:1 contrast)
  foregroundSecondary: '#6b7280', // Secondary text (4.8:1 contrast)
  border: '#e5e7eb',            // Visible border
  accent: '#3b82f6',            // High contrast accent
  accentForeground: '#ffffff',  // White on accent (4.5:1)
}
```

## Font Size and Typography

### Minimum Font Sizes

- **Body text**: Minimum 16px (1rem) for readability
- **Small text**: Minimum 14px (0.875rem) - use sparingly
- **Headings**: Scale appropriately (1.25rem to 3rem)

### Line Height

- **Tight**: 1.25 - Use for headings
- **Normal**: 1.5 - Use for body text (recommended)
- **Relaxed**: 1.75 - Use for long-form content
- **Loose**: 2 - Use for maximum readability

### Font Weight

- **Normal (400)**: Body text
- **Medium (500)**: Emphasis
- **Semibold (600)**: Headings, important text
- **Bold (700)**: Strong emphasis

### Typography Best Practices

1. **Maintain readable line length**: 50-75 characters per line
2. **Use sufficient line height**: At least 1.5 for body text
3. **Avoid all caps**: Use sparingly, can reduce readability
4. **Provide text scaling**: Support up to 200% zoom without breaking layout

## Spacing and Layout

### Spacing Scale

Use consistent spacing tokens:

- **xs**: 4px - Tight spacing
- **sm**: 8px - Small gaps
- **md**: 16px - Default spacing
- **lg**: 24px - Large gaps
- **xl**: 32px - Extra large gaps

### Layout Considerations

1. **Touch targets**: Minimum 44x44px for interactive elements
2. **Focus indicators**: At least 2px outline with sufficient contrast
3. **Content spacing**: Adequate whitespace between sections
4. **Responsive breakpoints**: Ensure content is readable at all sizes

## WCAG Requirements

### Level A Requirements

- ✅ Color is not the only means of conveying information
- ✅ Text contrast ratio of at least 4.5:1 (normal) or 3:1 (large)
- ✅ Non-text contrast ratio of at least 3:1
- ✅ Text can be resized up to 200% without loss of functionality

### Level AA Requirements

- ✅ Text contrast ratio of at least 4.5:1 (normal) or 3:1 (large)
- ✅ Focus indicators are visible
- ✅ Content reflows properly at 320px width
- ✅ Text spacing can be adjusted (line height, paragraph spacing)

### Level AAA Requirements (Optional)

- ✅ Text contrast ratio of at least 7:1 (normal) or 4.5:1 (large)
- ✅ No background images that interfere with text readability

## Examples

### Good Theme Example

```typescript
const accessibleLightTheme = {
  colors: {
    background: '#ffffff',
    foreground: '#111827',           // 16.6:1 contrast
    foregroundSecondary: '#6b7280', // 4.8:1 contrast
    accent: '#3b82f6',              // High contrast
    accentForeground: '#ffffff',     // 4.5:1 on accent
    border: '#e5e7eb',               // Visible border
  },
  typography: {
    fontSize: {
      base: '1rem',    // 16px minimum
      sm: '0.875rem',  // 14px minimum
    },
    lineHeight: {
      normal: '1.5',   // Accessible line height
    },
  },
};
```

### Poor Theme Example

```typescript
const inaccessibleTheme = {
  colors: {
    background: '#f9fafb',
    foreground: '#d1d5db',           // 2.1:1 contrast - FAILS
    foregroundSecondary: '#e5e7eb',  // 1.2:1 contrast - FAILS
    accent: '#9ca3af',               // Low contrast
    accentForeground: '#f3f4f6',     // 1.1:1 contrast - FAILS
    border: '#f3f4f6',               // Barely visible
  },
  typography: {
    fontSize: {
      base: '0.75rem',  // 12px - too small
    },
    lineHeight: {
      normal: '1.2',    // Too tight
    },
  },
};
```

## Testing

### Automated Testing

Use tools to verify contrast ratios:

1. **Browser DevTools**: Check computed contrast ratios
2. **axe DevTools**: Automated accessibility testing
3. **WAVE**: Web accessibility evaluation tool
4. **Contrast Checker**: Online tools for color contrast

### Manual Testing

1. **Zoom test**: Zoom to 200% and verify readability
2. **Color blindness simulation**: Test with color blindness simulators
3. **Keyboard navigation**: Ensure all interactive elements are accessible
4. **Screen reader**: Test with screen readers (NVDA, JAWS, VoiceOver)

### Theme Validation

The design system includes theme validation:

```typescript
import { validateTheme } from '@chai-vc/design-system';

const result = validateTheme(myTheme);
if (!result.valid) {
  console.error('Theme validation errors:', result.errors);
}
```

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [A11y Project](https://www.a11yproject.com/)
- [MDN Accessibility Guide](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

## Integration

This guide is integrated into the design system documentation. When creating custom themes, refer to this guide to ensure accessibility compliance.

