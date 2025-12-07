# VitalCV Component Development Checklist

Use this checklist when creating or updating UI components to ensure consistency and quality.

## ✅ Design System Compliance

### Visual Design
- [ ] Follows VitalCV color palette (green/red/gray for status)
- [ ] Uses Geist font family consistently
- [ ] Implements glassmorphism effects where appropriate
- [ ] Maintains consistent spacing using Tailwind scale
- [ ] Responsive design works on mobile and desktop

### Typography
- [ ] Text hierarchy is clear and logical
- [ ] Font sizes follow established scale
- [ ] Line heights provide good readability
- [ ] Color contrast meets WCAG AA standards (4.5:1 minimum)

## ✅ Component Architecture

### Props Interface
- [ ] Props are well-typed with TypeScript
- [ ] Required props are clearly marked
- [ ] Default values are provided for optional props
- [ ] Props follow consistent naming conventions
- [ ] Component accepts `className` for styling flexibility

### Code Quality
- [ ] Component is properly exported
- [ ] Uses React best practices (hooks, memo when needed)
- [ ] Error boundaries handle edge cases
- [ ] No console.log statements in production code
- [ ] Code is properly formatted and linted

## ✅ Functionality

### Core Features
- [ ] Component renders correctly with all prop combinations
- [ ] Handles loading states appropriately
- [ ] Error states are handled gracefully
- [ ] User interactions work as expected
- [ ] Form validation works correctly (if applicable)

### Performance
- [ ] Component doesn't cause unnecessary re-renders
- [ ] Large lists use virtualization if needed
- [ ] Images are optimized and lazy-loaded
- [ ] Bundle size impact is minimal

## ✅ Accessibility (WCAG 2.1 AA)

### Keyboard Navigation
- [ ] All interactive elements are keyboard accessible
- [ ] Tab order is logical and intuitive
- [ ] Focus indicators are clearly visible
- [ ] Escape key closes modals/dropdowns

### Screen Reader Support
- [ ] Proper ARIA labels and descriptions
- [ ] Semantic HTML elements used correctly
- [ ] Form fields have associated labels
- [ ] Status messages are announced
- [ ] Loading states are communicated

### Visual Accessibility
- [ ] Color is not the only way to convey information
- [ ] Text has sufficient contrast ratios
- [ ] Focus indicators are visible
- [ ] Component works with browser zoom up to 200%

## ✅ Testing

### Unit Tests
- [ ] Component renders without crashing
- [ ] All props are tested
- [ ] User interactions are tested
- [ ] Error states are tested
- [ ] Edge cases are covered
- [ ] Test coverage is >90%

### Integration Tests
- [ ] Component works with other components
- [ ] API integration works correctly
- [ ] Form submission flows work
- [ ] Navigation between states works

### Visual Testing
- [ ] Storybook story created with all variants
- [ ] Visual regression tests pass
- [ ] Component looks correct in all browsers
- [ ] Responsive design tested on multiple screen sizes

## ✅ Documentation

### Storybook
- [ ] Story covers all component variants
- [ ] Controls are properly configured
- [ ] Documentation is clear and helpful
- [ ] Examples show real-world usage

### Code Documentation
- [ ] Component has JSDoc comments
- [ ] Complex logic is explained
- [ ] Props interface is documented
- [ ] Usage examples are provided

### README Updates
- [ ] Component is listed in components README
- [ ] Usage examples are provided
- [ ] Any special considerations are noted

## ✅ Review Process

### Self Review
- [ ] Code follows project conventions
- [ ] No TODO comments left in code
- [ ] All tests pass locally
- [ ] Storybook builds without errors
- [ ] Component works in development environment

### Peer Review
- [ ] Code review completed by team member
- [ ] Design review completed by designer
- [ ] Accessibility review completed
- [ ] Performance impact assessed

### Final Checks
- [ ] Component is properly integrated
- [ ] Documentation is updated
- [ ] Tests are passing in CI
- [ ] Ready for production deployment

## 🚀 Deployment

### Pre-deployment
- [ ] All tests pass in CI/CD pipeline
- [ ] Storybook builds successfully
- [ ] No breaking changes introduced
- [ ] Version number updated if needed

### Post-deployment
- [ ] Component works in production
- [ ] No console errors in browser
- [ ] Performance metrics are acceptable
- [ ] User feedback is positive

---

**Note**: This checklist should be completed for every new component and major component update. Keep this document updated as standards evolve.
