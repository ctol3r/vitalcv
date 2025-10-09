/**
 * Accessibility Testing Utilities
 *
 * Helpers for testing WCAG 2.1 AA compliance
 */

import { render, RenderOptions } from '@testing-library/react'
import { axe, toHaveNoViolations, JestAxeConfigureOptions } from 'jest-axe'
import { ReactElement } from 'react'

// Extend Jest matchers (also done in jest.setup.js, but TypeScript needs it here)
expect.extend(toHaveNoViolations)

/**
 * Default axe configuration for WCAG 2.1 AA compliance
 */
export const defaultAxeConfig: JestAxeConfigureOptions = {
  rules: {
    // WCAG 2.1 AA compliance
    'color-contrast': { enabled: true },
    'valid-aria-*': { enabled: true },
    'aria-*': { enabled: true },
    'label': { enabled: true },
    'button-name': { enabled: true },
    'link-name': { enabled: true },
    'image-alt': { enabled: true },
    'document-title': { enabled: true },
    'html-has-lang': { enabled: true },
    'landmark-one-main': { enabled: true },
    'page-has-heading-one': { enabled: true },
    'region': { enabled: true },
  },
}

/**
 * Test a component for accessibility violations
 *
 * @example
 * test('should have no accessibility violations', async () => {
 *   const { container } = render(<MyComponent />)
 *   await expectNoA11yViolations(container)
 * })
 */
export async function expectNoA11yViolations(
  container: Element | Document,
  config?: JestAxeConfigureOptions
) {
  const results = await axe(container, config || defaultAxeConfig)
  expect(results).toHaveNoViolations()
}

/**
 * Render a component and run accessibility tests
 *
 * @example
 * test('button should be accessible', async () => {
 *   await renderWithA11yCheck(<Button>Click me</Button>)
 * })
 */
export async function renderWithA11yCheck(
  ui: ReactElement,
  options?: RenderOptions,
  axeConfig?: JestAxeConfigureOptions
) {
  const renderResult = render(ui, options)
  await expectNoA11yViolations(renderResult.container, axeConfig)
  return renderResult
}

/**
 * Test keyboard navigation for a component
 *
 * @example
 * test('should be keyboard navigable', async () => {
 *   const { container } = render(<MyForm />)
 *   const result = await testKeyboardNavigation(container)
 *   expect(result.focusableElements.length).toBeGreaterThan(0)
 * })
 */
export async function testKeyboardNavigation(container: Element | Document) {
  // Get all focusable elements
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',')

  const focusableElements = Array.from(
    container.querySelectorAll(focusableSelectors)
  )

  return {
    focusableElements,
    count: focusableElements.length,
    tabOrder: focusableElements.map((el) => ({
      tag: el.tagName.toLowerCase(),
      tabIndex: el.getAttribute('tabindex'),
      ariaLabel: el.getAttribute('aria-label'),
    })),
  }
}

/**
 * Test screen reader accessibility
 *
 * @example
 * test('should have proper ARIA labels', () => {
 *   const { container } = render(<MyComponent />)
 *   const ariaInfo = getAriaInfo(container)
 *   expect(ariaInfo.labels.length).toBeGreaterThan(0)
 * })
 */
export function getAriaInfo(container: Element | Document) {
  const elementsWithAriaLabel = Array.from(
    container.querySelectorAll('[aria-label]')
  )
  const elementsWithAriaLabelledBy = Array.from(
    container.querySelectorAll('[aria-labelledby]')
  )
  const elementsWithAriaDescribedBy = Array.from(
    container.querySelectorAll('[aria-describedby]')
  )
  const landmarks = Array.from(
    container.querySelectorAll('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], [role="region"]')
  )

  return {
    labels: elementsWithAriaLabel.map((el) => ({
      tag: el.tagName.toLowerCase(),
      label: el.getAttribute('aria-label'),
    })),
    labelledBy: elementsWithAriaLabelledBy.map((el) => ({
      tag: el.tagName.toLowerCase(),
      labelledBy: el.getAttribute('aria-labelledby'),
    })),
    describedBy: elementsWithAriaDescribedBy.map((el) => ({
      tag: el.tagName.toLowerCase(),
      describedBy: el.getAttribute('aria-describedby'),
    })),
    landmarks: landmarks.map((el) => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      label: el.getAttribute('aria-label'),
    })),
  }
}

/**
 * Test color contrast ratios (requires manual verification)
 * Returns elements that may have contrast issues
 *
 * @example
 * test('should check for potential contrast issues', () => {
 *   const { container } = render(<MyComponent />)
 *   const elements = getElementsForContrastCheck(container)
 *   // Manual verification required
 * })
 */
export function getElementsForContrastCheck(container: Element | Document) {
  const textElements = Array.from(
    container.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, a, button, label, input, textarea')
  )

  return textElements.map((el) => {
    const computedStyle = window.getComputedStyle(el)
    return {
      element: el,
      tag: el.tagName.toLowerCase(),
      color: computedStyle.color,
      backgroundColor: computedStyle.backgroundColor,
      fontSize: computedStyle.fontSize,
      fontWeight: computedStyle.fontWeight,
    }
  })
}

/**
 * Check if an element is visible to screen readers
 */
export function isVisibleToScreenReaders(element: Element): boolean {
  const ariaHidden = element.getAttribute('aria-hidden')
  if (ariaHidden === 'true') return false

  const role = element.getAttribute('role')
  if (role === 'presentation' || role === 'none') return false

  const computedStyle = window.getComputedStyle(element)
  if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') return false

  return true
}

/**
 * Get accessibility tree information
 * Useful for debugging screen reader experience
 */
export function getAccessibilityTree(container: Element | Document) {
  const getAllElements = (node: Element): any[] => {
    const children = Array.from(node.children)
    const childrenInfo = children.flatMap(child => getAllElements(child))

    const ariaLabel = node.getAttribute('aria-label')
    const ariaLabelledBy = node.getAttribute('aria-labelledby')
    const role = node.getAttribute('role')
    const ariaHidden = node.getAttribute('aria-hidden')

    // Only include elements with accessibility information
    if (ariaLabel || ariaLabelledBy || role || ariaHidden) {
      return [
        {
          tag: node.tagName.toLowerCase(),
          role,
          ariaLabel,
          ariaLabelledBy,
          ariaHidden,
          visible: isVisibleToScreenReaders(node),
        },
        ...childrenInfo,
      ]
    }

    return childrenInfo
  }

  const root = container instanceof Document ? container.body : container
  return getAllElements(root)
}
