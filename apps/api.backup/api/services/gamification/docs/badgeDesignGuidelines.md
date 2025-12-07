# Badge Design Guidelines

**B247B-GAM-018**: Document guidelines for designing badge icons and levels: size, colour palette, typography, accessibility; includes examples and do's/don'ts; integrated into design system docs

## Overview

This document provides comprehensive guidelines for designing badge icons and visual elements for the gamification system. These guidelines ensure consistency, accessibility, and a cohesive user experience across the platform.

## Badge Levels

Badges are organized into levels to represent progression and achievement tiers:

- **Level 1 (Bronze)**: Entry-level achievements, first steps
- **Level 2 (Silver)**: Intermediate achievements, consistent engagement
- **Level 3 (Gold)**: Advanced achievements, significant milestones
- **Level 4 (Platinum)**: Elite achievements, exceptional accomplishments
- **Level 5 (Diamond)**: Legendary achievements, rare accomplishments

## Icon Specifications

### Size

- **Primary Size**: 64x64 pixels (for display in badge lists and user profiles)
- **Thumbnail Size**: 32x32 pixels (for compact views and notifications)
- **Large Size**: 128x128 pixels (for badge detail pages and celebrations)
- **Export Format**: SVG (scalable) with PNG fallback at 2x resolution

### Design Principles

1. **Clarity**: Icons should be immediately recognizable and convey the achievement clearly
2. **Simplicity**: Avoid excessive detail that becomes unclear at small sizes
3. **Consistency**: Maintain visual consistency across badge families
4. **Accessibility**: Ensure sufficient contrast and avoid relying solely on color

## Color Palette

### Level-Based Colors

Each badge level has an associated color scheme:

#### Level 1 (Bronze)
- Primary: `#CD7F32` (Bronze)
- Secondary: `#E8A87C` (Light Bronze)
- Accent: `#8B4513` (Saddle Brown)

#### Level 2 (Silver)
- Primary: `#C0C0C0` (Silver)
- Secondary: `#E8E8E8` (Light Silver)
- Accent: `#808080` (Gray)

#### Level 3 (Gold)
- Primary: `#FFD700` (Gold)
- Secondary: `#FFE55C` (Light Gold)
- Accent: `#B8860B` (Dark Goldenrod)

#### Level 4 (Platinum)
- Primary: `#E5E4E2` (Platinum)
- Secondary: `#F5F5F5` (White Smoke)
- Accent: `#A8A8A8` (Gray)

#### Level 5 (Diamond)
- Primary: `#B9F2FF` (Diamond Blue)
- Secondary: `#E0F7FF` (Light Blue)
- Accent: `#0096FF` (Blue)

### Usage Guidelines

- Use level colors for badge borders, backgrounds, or accent elements
- Maintain sufficient contrast (WCAG AA minimum: 4.5:1 for text, 3:1 for graphics)
- Avoid using level colors as the sole differentiator (include iconography)

## Typography

### Badge Names

- **Font**: System font stack (San Francisco on iOS, Roboto on Android, Segoe UI on Windows)
- **Size**: 14px (regular), 16px (large displays)
- **Weight**: Medium (500) for badge names
- **Color**: `#1A1A1A` (dark text) or `#FFFFFF` (light text) depending on background

### Descriptions

- **Font**: System font stack
- **Size**: 12px (regular), 14px (large displays)
- **Weight**: Regular (400)
- **Color**: `#666666` (secondary text)

## Accessibility

### Contrast Requirements

- **Text on Background**: Minimum 4.5:1 contrast ratio (WCAG AA)
- **Graphics**: Minimum 3:1 contrast ratio for non-text elements
- **Focus Indicators**: Clear focus states for interactive badge elements

### Alternative Text

- All badge icons must have descriptive alt text
- Format: "[Badge Name] - [Description]"
- Example: "First Steps Badge - Awarded for completing your first action"

### Screen Reader Support

- Badge names should be announced clearly
- Progress information should be accessible
- Award notifications should include badge name and description

## Design Examples

### ✅ Do's

1. **Use Clear Iconography**
   - Simple, recognizable symbols
   - Consistent style within badge families
   - Appropriate for the achievement type

2. **Maintain Visual Hierarchy**
   - Level colors should be subtle, not overwhelming
   - Icon should be the primary visual element
   - Text should be readable at all sizes

3. **Consider Context**
   - Design for both light and dark themes
   - Ensure visibility in lists and detail views
   - Test at various sizes

4. **Follow Platform Guidelines**
   - iOS: Human Interface Guidelines
   - Android: Material Design
   - Web: Platform design system

### ❌ Don'ts

1. **Avoid Over-Complexity**
   - Don't include too many details
   - Don't use text within icons
   - Don't create icons that are unclear at small sizes

2. **Don't Rely on Color Alone**
   - Always include iconography
   - Use patterns or shapes as additional differentiators
   - Ensure grayscale versions are still meaningful

3. **Avoid Inconsistent Styling**
   - Don't mix different icon styles
   - Don't use conflicting color schemes
   - Don't break established patterns

4. **Don't Ignore Accessibility**
   - Don't use low contrast colors
   - Don't create icons that are too small
   - Don't forget alt text

## Badge Categories

### Achievement Types

1. **Milestone Badges**: Celebrate specific numbers (e.g., "100 Logins")
   - Icon: Number or milestone symbol
   - Style: Bold, celebratory

2. **Streak Badges**: Recognize consistency (e.g., "7 Day Streak")
   - Icon: Fire, flame, or continuity symbol
   - Style: Dynamic, energetic

3. **Skill Badges**: Demonstrate expertise (e.g., "Expert User")
   - Icon: Skill-related symbol (star, trophy, etc.)
   - Style: Professional, authoritative

4. **Social Badges**: Community engagement (e.g., "Helpful Contributor")
   - Icon: Social symbols (handshake, heart, etc.)
   - Style: Friendly, approachable

5. **Special Badges**: Rare or unique achievements
   - Icon: Unique, memorable symbols
   - Style: Distinctive, eye-catching

## Implementation

### Icon Storage

- Store icons in `/services/gamification/icons/`
- Use consistent naming: `{badge-slug}.svg` and `{badge-slug}@2x.png`
- Reference icons via `iconId` field in Badge model

### Integration with Design System

- Badge components should use design system tokens
- Colors should reference design system palette
- Typography should use design system fonts
- Spacing should follow design system grid

## Testing

### Visual Testing

- Test at all specified sizes
- Test in light and dark themes
- Test with various screen readers
- Test with color blindness simulators

### Accessibility Testing

- Verify contrast ratios meet WCAG AA standards
- Test with screen readers
- Verify keyboard navigation
- Test with zoom levels up to 200%

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Material Design Icons](https://fonts.google.com/icons)
- [Human Interface Guidelines - SF Symbols](https://developer.apple.com/design/human-interface-guidelines/sf-symbols)
- [Accessible Color Palette Generator](https://coolors.co/contrast-checker)

## Revision History

- **2025-11-16**: Initial version (B247B-GAM-018)

