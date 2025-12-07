/**
 * Accessibility Utilities
 * Focus management, ARIA helpers, and keyboard navigation utilities
 */

/**
 * Trap focus within a container
 * Useful for modals and dialogs
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableSelectors = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ')

  const focusableElements = Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelectors)
  ).filter((el) => {
    const style = window.getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })

  if (focusableElements.length === 0) return () => {}

  const firstFocusable = focusableElements[0]
  const lastFocusable = focusableElements[focusableElements.length - 1]

  const handleTab = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault()
        lastFocusable?.focus()
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault()
        firstFocusable?.focus()
      }
    }
  }

  container.addEventListener('keydown', handleTab)

  // Focus first element
  firstFocusable?.focus()

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleTab)
  }
}

/**
 * Make content inert (non-interactive) for screen readers
 */
export function setInert(element: HTMLElement, inert: boolean): void {
  if (inert) {
    element.setAttribute('inert', '')
    element.setAttribute('aria-hidden', 'true')
  } else {
    element.removeAttribute('inert')
    element.removeAttribute('aria-hidden')
  }
}

/**
 * Keyboard event helpers
 */
export const keys = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  TAB: 'Tab',
  HOME: 'Home',
  END: 'End',
} as const

export function isKey(event: KeyboardEvent, key: string): boolean {
  return event.key === key
}

