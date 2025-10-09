/**
 * Focus Management Utilities
 *
 * Helpers for managing keyboard focus in complex components
 * (modals, dropdowns, tabs, etc.)
 */

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []

  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    'audio[controls]',
    'video[controls]',
    '[contenteditable]:not([contenteditable="false"])',
  ].join(',')

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors))
}

/**
 * Trap focus within a container (for modals, dropdowns)
 *
 * @example
 * useEffect(() => {
 *   const trap = focusTrap(dialogRef.current)
 *   return () => trap.deactivate()
 * }, [])
 */
export function focusTrap(container: HTMLElement | null) {
  if (!container) {
    return { activate: () => {}, deactivate: () => {} }
  }

  const focusableElements = getFocusableElements(container)
  const firstFocusable = focusableElements[0]
  const lastFocusable = focusableElements[focusableElements.length - 1]

  // Store previously focused element
  const previouslyFocused = document.activeElement as HTMLElement

  // Focus first element
  firstFocusable?.focus()

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return

    // If only one focusable element, prevent tabbing
    if (focusableElements.length === 1) {
      e.preventDefault()
      return
    }

    // Shift + Tab (backwards)
    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault()
        lastFocusable?.focus()
      }
    }
    // Tab (forwards)
    else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault()
        firstFocusable?.focus()
      }
    }
  }

  container.addEventListener('keydown', handleKeyDown)

  return {
    activate: () => {
      firstFocusable?.focus()
    },
    deactivate: () => {
      container.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    },
  }
}

/**
 * Focus first error in a form
 *
 * @example
 * const handleSubmit = (e) => {
 *   e.preventDefault()
 *   const errors = validate(formData)
 *   if (errors.length > 0) {
 *     focusFirstError(formRef.current, errors)
 *   }
 * }
 */
export function focusFirstError(
  container: HTMLElement | null,
  errorFieldIds: string[]
): void {
  if (!container || errorFieldIds.length === 0) return

  for (const fieldId of errorFieldIds) {
    const element = container.querySelector<HTMLElement>(`#${fieldId}`)
    if (element) {
      element.focus()
      // Scroll into view if needed
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
  }
}

/**
 * Create a focus scope for roving tabindex
 * Useful for toolbars, menus, tabs with arrow key navigation
 *
 * @example
 * const { handleKeyDown, setFocusedIndex } = useRovingTabIndex(items.length)
 */
export function createRovingTabIndex(
  elements: HTMLElement[],
  currentIndex: number,
  orientation: 'horizontal' | 'vertical' = 'horizontal'
) {
  const handleKeyDown = (e: KeyboardEvent) => {
    const isHorizontal = orientation === 'horizontal'
    const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp'
    const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown'

    let newIndex = currentIndex

    switch (e.key) {
      case prevKey:
        e.preventDefault()
        newIndex = currentIndex > 0 ? currentIndex - 1 : elements.length - 1
        break
      case nextKey:
        e.preventDefault()
        newIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : 0
        break
      case 'Home':
        e.preventDefault()
        newIndex = 0
        break
      case 'End':
        e.preventDefault()
        newIndex = elements.length - 1
        break
      default:
        return
    }

    // Update tabindex and focus
    elements.forEach((el, index) => {
      el.setAttribute('tabindex', index === newIndex ? '0' : '-1')
    })
    elements[newIndex]?.focus()

    return newIndex
  }

  return { handleKeyDown }
}

/**
 * Save and restore focus
 * Useful when temporarily moving focus (e.g., opening a modal)
 *
 * @example
 * const restoreFocus = saveFocus()
 * // ... do something ...
 * restoreFocus()
 */
export function saveFocus(): () => void {
  const previouslyFocused = document.activeElement as HTMLElement

  return () => {
    previouslyFocused?.focus()
  }
}

/**
 * Focus element by ID with fallback
 */
export function focusElement(
  elementOrId: string | HTMLElement | null,
  options?: {
    preventScroll?: boolean
    fallback?: () => void
  }
): void {
  let element: HTMLElement | null = null

  if (typeof elementOrId === 'string') {
    element = document.getElementById(elementOrId)
  } else {
    element = elementOrId
  }

  if (element) {
    element.focus({ preventScroll: options?.preventScroll })
  } else {
    options?.fallback?.()
  }
}

/**
 * Check if element is focused
 */
export function isFocused(element: HTMLElement | null): boolean {
  return element === document.activeElement
}

/**
 * Check if focus is within container
 */
export function isFocusWithin(container: HTMLElement | null): boolean {
  if (!container) return false
  return container.contains(document.activeElement)
}

/**
 * Move focus to next/previous element in tab order
 */
export function moveFocus(
  direction: 'next' | 'previous',
  fromElement?: HTMLElement
): void {
  const start = fromElement || (document.activeElement as HTMLElement)
  if (!start) return

  const focusableElements = getFocusableElements(document.body)
  const currentIndex = focusableElements.indexOf(start)

  if (currentIndex === -1) return

  const nextIndex =
    direction === 'next'
      ? (currentIndex + 1) % focusableElements.length
      : (currentIndex - 1 + focusableElements.length) % focusableElements.length

  focusableElements[nextIndex]?.focus()
}

/**
 * Keyboard event helpers
 */
export const KeyboardKeys = {
  Enter: 'Enter',
  Space: ' ',
  Escape: 'Escape',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  Home: 'Home',
  End: 'End',
  Tab: 'Tab',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
} as const

/**
 * Check if key is activation key (Enter or Space)
 */
export function isActivationKey(event: KeyboardEvent): boolean {
  return event.key === KeyboardKeys.Enter || event.key === KeyboardKeys.Space
}

/**
 * Handle button keyboard activation
 * Prevents default for Space to avoid page scroll
 */
export function handleButtonKeyDown(
  event: KeyboardEvent,
  onClick: () => void
): void {
  if (event.key === KeyboardKeys.Space) {
    event.preventDefault()
    onClick()
  } else if (event.key === KeyboardKeys.Enter) {
    onClick()
  }
}

/**
 * Focus visible only (not mouse clicks)
 * Adds 'focus-visible' class only for keyboard navigation
 */
export function setupFocusVisible(): () => void {
  let hadKeyboardEvent = true
  let hadFocusVisibleRecently = false
  let hadFocusVisibleRecentlyTimeout: NodeJS.Timeout | null = null

  const inputTypes = [
    'text',
    'search',
    'url',
    'tel',
    'email',
    'password',
    'number',
    'date',
    'month',
    'week',
    'time',
    'datetime',
    'datetime-local',
  ]

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Tab' || e.key === 'Shift' || e.key === 'Meta' || e.key === 'Alt' || e.key === 'Control') {
      hadKeyboardEvent = true
    }
  }

  function onPointerDown() {
    hadKeyboardEvent = false
  }

  function onFocus(e: FocusEvent) {
    if (e.target && shouldShowFocusRing(e.target as HTMLElement)) {
      if (hadKeyboardEvent) {
        (e.target as HTMLElement).setAttribute('data-focus-visible', 'true')
        hadFocusVisibleRecently = true

        if (hadFocusVisibleRecentlyTimeout) {
          clearTimeout(hadFocusVisibleRecentlyTimeout)
        }

        hadFocusVisibleRecentlyTimeout = setTimeout(() => {
          hadFocusVisibleRecently = false
        }, 100)
      }
    }
  }

  function onBlur(e: FocusEvent) {
    if (e.target) {
      (e.target as HTMLElement).removeAttribute('data-focus-visible')
    }
  }

  function shouldShowFocusRing(element: HTMLElement): boolean {
    const { tagName, type, readOnly, disabled } = element as HTMLInputElement

    // Always show for keyboard-focusable elements
    if (tagName === 'A' || tagName === 'BUTTON') return true

    // Show for form elements
    if (
      tagName === 'INPUT' &&
      inputTypes.includes(type) &&
      !readOnly &&
      !disabled
    ) {
      return true
    }

    if (
      (tagName === 'TEXTAREA' || tagName === 'SELECT') &&
      !readOnly &&
      !disabled
    ) {
      return true
    }

    // Show for custom elements with contenteditable
    if (element.isContentEditable) return true

    return false
  }

  // Add event listeners
  document.addEventListener('keydown', onKeyDown, true)
  document.addEventListener('mousedown', onPointerDown, true)
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('touchstart', onPointerDown, true)
  document.addEventListener('focus', onFocus, true)
  document.addEventListener('blur', onBlur, true)

  // Cleanup function
  return () => {
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('mousedown', onPointerDown, true)
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('touchstart', onPointerDown, true)
    document.removeEventListener('focus', onFocus, true)
    document.removeEventListener('blur', onBlur, true)

    if (hadFocusVisibleRecentlyTimeout) {
      clearTimeout(hadFocusVisibleRecentlyTimeout)
    }
  }
}
