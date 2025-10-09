/**
 * Accessibility Tests for Button Component
 *
 * WCAG 2.1 AA compliance tests
 */

import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/button'
import {
  expectNoA11yViolations,
  testKeyboardNavigation,
  getAriaInfo,
} from '@/lib/test-utils/accessibility'

describe('Button Accessibility', () => {
  describe('WCAG 2.1 AA Compliance', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<Button>Click me</Button>)
      await expectNoA11yViolations(container)
    })

    it('should have no violations with icon', async () => {
      const { container } = render(
        <Button>
          <span aria-hidden="true">🔍</span>
          Search
        </Button>
      )
      await expectNoA11yViolations(container)
    })

    it('should have no violations when disabled', async () => {
      const { container } = render(<Button disabled>Disabled</Button>)
      await expectNoA11yViolations(container)
    })
  })

  describe('Keyboard Navigation', () => {
    it('should be keyboard focusable', async () => {
      const { container } = render(<Button>Click me</Button>)
      const navInfo = await testKeyboardNavigation(container)

      expect(navInfo.count).toBe(1)
      expect(navInfo.focusableElements[0]?.tagName.toLowerCase()).toBe('button')
    })

    it('should not be focusable when disabled', async () => {
      const { container } = render(<Button disabled>Disabled</Button>)
      const navInfo = await testKeyboardNavigation(container)

      expect(navInfo.count).toBe(0)
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

    it('should support aria-describedby', () => {
      render(
        <div>
          <Button aria-describedby="button-description">Submit</Button>
          <p id="button-description">This will submit the form</p>
        </div>
      )

      const button = screen.getByRole('button', { name: /submit/i })
      expect(button).toHaveAttribute('aria-describedby', 'button-description')
    })
  })

  describe('ARIA Attributes', () => {
    it('should collect ARIA information', () => {
      const { container } = render(
        <Button aria-label="Test button" aria-describedby="desc">
          Click
        </Button>
      )

      const ariaInfo = getAriaInfo(container)
      expect(ariaInfo.labels.length).toBeGreaterThan(0)
    })

    it('should support aria-pressed for toggle buttons', () => {
      render(<Button aria-pressed="true">Toggle</Button>)
      const button = screen.getByRole('button', { name: /toggle/i })
      expect(button).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('Button Variants', () => {
    it('should be accessible with default variant', async () => {
      const { container } = render(<Button variant="default">Default</Button>)
      await expectNoA11yViolations(container)
    })

    it('should be accessible with destructive variant', async () => {
      const { container } = render(<Button variant="destructive">Delete</Button>)
      await expectNoA11yViolations(container)
    })

    it('should be accessible with outline variant', async () => {
      const { container } = render(<Button variant="outline">Outline</Button>)
      await expectNoA11yViolations(container)
    })

    it('should be accessible with ghost variant', async () => {
      const { container } = render(<Button variant="ghost">Ghost</Button>)
      await expectNoA11yViolations(container)
    })

    it('should be accessible with link variant', async () => {
      const { container } = render(<Button variant="link">Link</Button>)
      await expectNoA11yViolations(container)
    })
  })

  describe('Button Sizes', () => {
    it('should be accessible with default size', async () => {
      const { container } = render(<Button size="default">Default</Button>)
      await expectNoA11yViolations(container)
    })

    it('should be accessible with small size', async () => {
      const { container } = render(<Button size="sm">Small</Button>)
      await expectNoA11yViolations(container)
    })

    it('should be accessible with large size', async () => {
      const { container } = render(<Button size="lg">Large</Button>)
      await expectNoA11yViolations(container)
    })

    it('should be accessible with icon size', async () => {
      const { container } = render(<Button size="icon" aria-label="Icon button">🔍</Button>)
      await expectNoA11yViolations(container)
    })
  })
})
