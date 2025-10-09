/**
 * Accessibility Tests for Input Component
 *
 * WCAG 2.1 AA compliance tests
 */

import { render, screen } from '@testing-library/react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  expectNoA11yViolations,
  testKeyboardNavigation,
  getAriaInfo,
} from '@/lib/test-utils/accessibility'

describe('Input Accessibility', () => {
  describe('WCAG 2.1 AA Compliance', () => {
    it('should have no accessibility violations with label', async () => {
      const { container } = render(
        <div>
          <Label htmlFor="test-input">Name</Label>
          <Input id="test-input" />
        </div>
      )
      await expectNoA11yViolations(container)
    })

    it('should have no violations with aria-label', async () => {
      const { container } = render(<Input aria-label="Search" />)
      await expectNoA11yViolations(container)
    })

    it('should have no violations when disabled', async () => {
      const { container } = render(
        <div>
          <Label htmlFor="disabled-input">Disabled</Label>
          <Input id="disabled-input" disabled />
        </div>
      )
      await expectNoA11yViolations(container)
    })

    it('should have no violations with placeholder', async () => {
      const { container } = render(
        <div>
          <Label htmlFor="placeholder-input">Email</Label>
          <Input id="placeholder-input" placeholder="Enter your email" />
        </div>
      )
      await expectNoA11yViolations(container)
    })
  })

  describe('Keyboard Navigation', () => {
    it('should be keyboard focusable', async () => {
      const { container } = render(<Input aria-label="Test input" />)
      const navInfo = await testKeyboardNavigation(container)

      expect(navInfo.count).toBe(1)
      expect(navInfo.focusableElements[0]?.tagName.toLowerCase()).toBe('input')
    })

    it('should not be focusable when disabled', async () => {
      const { container } = render(<Input disabled aria-label="Disabled input" />)
      const navInfo = await testKeyboardNavigation(container)

      expect(navInfo.count).toBe(0)
    })
  })

  describe('Screen Reader Support', () => {
    it('should be accessible with associated label', () => {
      render(
        <div>
          <Label htmlFor="name-input">Name</Label>
          <Input id="name-input" />
        </div>
      )

      const input = screen.getByLabelText(/name/i)
      expect(input).toBeInTheDocument()
    })

    it('should support aria-label', () => {
      render(<Input aria-label="Search query" />)
      const input = screen.getByLabelText(/search query/i)
      expect(input).toBeInTheDocument()
    })

    it('should support aria-describedby for error messages', () => {
      render(
        <div>
          <Label htmlFor="email-input">Email</Label>
          <Input id="email-input" aria-describedby="email-error" aria-invalid="true" />
          <p id="email-error">Please enter a valid email address</p>
        </div>
      )

      const input = screen.getByLabelText(/email/i)
      expect(input).toHaveAttribute('aria-describedby', 'email-error')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('should announce disabled state', () => {
      render(
        <div>
          <Label htmlFor="disabled-input">Disabled field</Label>
          <Input id="disabled-input" disabled />
        </div>
      )

      const input = screen.getByLabelText(/disabled field/i)
      expect(input).toBeDisabled()
    })

    it('should announce required state', () => {
      render(
        <div>
          <Label htmlFor="required-input">Required field</Label>
          <Input id="required-input" required />
        </div>
      )

      const input = screen.getByLabelText(/required field/i)
      expect(input).toBeRequired()
    })
  })

  describe('ARIA Attributes', () => {
    it('should collect ARIA information', () => {
      const { container } = render(
        <Input aria-label="Test input" aria-describedby="desc" />
      )

      const ariaInfo = getAriaInfo(container)
      expect(ariaInfo.labels.length).toBeGreaterThan(0)
    })

    it('should support aria-invalid for validation errors', () => {
      render(<Input aria-label="Email" aria-invalid="true" />)
      const input = screen.getByLabelText(/email/i)
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('should support aria-required', () => {
      render(<Input aria-label="Name" aria-required="true" />)
      const input = screen.getByLabelText(/name/i)
      expect(input).toHaveAttribute('aria-required', 'true')
    })
  })

  describe('Input Types', () => {
    it('should be accessible with text type', async () => {
      const { container } = render(
        <div>
          <Label htmlFor="text-input">Text</Label>
          <Input id="text-input" type="text" />
        </div>
      )
      await expectNoA11yViolations(container)
    })

    it('should be accessible with email type', async () => {
      const { container } = render(
        <div>
          <Label htmlFor="email-input">Email</Label>
          <Input id="email-input" type="email" />
        </div>
      )
      await expectNoA11yViolations(container)
    })

    it('should be accessible with password type', async () => {
      const { container } = render(
        <div>
          <Label htmlFor="password-input">Password</Label>
          <Input id="password-input" type="password" />
        </div>
      )
      await expectNoA11yViolations(container)
    })

    it('should be accessible with number type', async () => {
      const { container } = render(
        <div>
          <Label htmlFor="number-input">Age</Label>
          <Input id="number-input" type="number" />
        </div>
      )
      await expectNoA11yViolations(container)
    })

    it('should be accessible with tel type', async () => {
      const { container } = render(
        <div>
          <Label htmlFor="tel-input">Phone</Label>
          <Input id="tel-input" type="tel" />
        </div>
      )
      await expectNoA11yViolations(container)
    })

    it('should be accessible with url type', async () => {
      const { container } = render(
        <div>
          <Label htmlFor="url-input">Website</Label>
          <Input id="url-input" type="url" />
        </div>
      )
      await expectNoA11yViolations(container)
    })
  })

  describe('Form Validation', () => {
    it('should properly associate error messages', async () => {
      const { container } = render(
        <div>
          <Label htmlFor="validation-input">Email</Label>
          <Input
            id="validation-input"
            type="email"
            aria-invalid="true"
            aria-describedby="email-error"
          />
          <span id="email-error" role="alert">
            Please enter a valid email address
          </span>
        </div>
      )

      await expectNoA11yViolations(container)

      const input = screen.getByLabelText(/email/i)
      const error = screen.getByRole('alert')

      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input).toHaveAttribute('aria-describedby', 'email-error')
      expect(error).toHaveTextContent('Please enter a valid email address')
    })
  })
})
