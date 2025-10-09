/**
 * React Hooks for Focus Management
 */

import { useEffect, useRef, useState, useCallback, RefObject } from 'react'
import {
  focusTrap,
  getFocusableElements,
  createRovingTabIndex,
  saveFocus,
  isFocusWithin,
  setupFocusVisible,
} from '@/lib/utils/focus-management'

/**
 * Hook to trap focus within a container
 *
 * @example
 * function Dialog() {
 *   const dialogRef = useFocusTrap(isOpen)
 *   return (
 *     <div ref={dialogRef} role="dialog">
 *       ...
 *     </div>
 *   )
 * }
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  enabled: boolean = true
): RefObject<T> {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!enabled || !ref.current) return

    const trap = focusTrap(ref.current)

    return () => {
      trap.deactivate()
    }
  }, [enabled])

  return ref
}

/**
 * Hook to save and restore focus
 *
 * @example
 * function Modal() {
 *   const restoreFocus = useFocusReturn(isOpen)
 *
 *   useEffect(() => {
 *     return () => restoreFocus()
 *   }, [])
 *
 *   return <div>...</div>
 * }
 */
export function useFocusReturn(condition: boolean = true): () => void {
  const restoreFocusRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (condition) {
      restoreFocusRef.current = saveFocus()
    }

    return () => {
      if (condition && restoreFocusRef.current) {
        restoreFocusRef.current()
      }
    }
  }, [condition])

  return useCallback(() => {
    restoreFocusRef.current?.()
  }, [])
}

/**
 * Hook for roving tabindex navigation
 * Useful for toolbars, menus, tabs with arrow key navigation
 *
 * @example
 * function Toolbar() {
 *   const [focusedIndex, setFocusedIndex] = useRovingTabIndex(items.length)
 *
 *   return (
 *     <div role="toolbar">
 *       {items.map((item, index) => (
 *         <button
 *           key={index}
 *           tabIndex={focusedIndex === index ? 0 : -1}
 *           onFocus={() => setFocusedIndex(index)}
 *         >
 *           {item}
 *         </button>
 *       ))}
 *     </div>
 *   )
 * }
 */
export function useRovingTabIndex(
  length: number,
  orientation: 'horizontal' | 'vertical' = 'horizontal'
): [number, (index: number) => void, (e: React.KeyboardEvent) => void] {
  const [focusedIndex, setFocusedIndex] = useState(0)
  const elementsRef = useRef<HTMLElement[]>([])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const { handleKeyDown } = createRovingTabIndex(
        elementsRef.current,
        focusedIndex,
        orientation
      )

      const newIndex = handleKeyDown(e.nativeEvent)
      if (newIndex !== undefined) {
        setFocusedIndex(newIndex)
      }
    },
    [focusedIndex, orientation]
  )

  return [focusedIndex, setFocusedIndex, handleKeyDown]
}

/**
 * Hook to detect if focus is within container
 *
 * @example
 * function Dropdown() {
 *   const [ref, isFocused] = useFocusWithin()
 *
 *   useEffect(() => {
 *     if (!isFocused) {
 *       closeDropdown()
 *     }
 *   }, [isFocused])
 *
 *   return <div ref={ref}>...</div>
 * }
 */
export function useFocusWithin<T extends HTMLElement = HTMLElement>(): [
  RefObject<T>,
  boolean
] {
  const ref = useRef<T>(null)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    const container = ref.current
    if (!container) return

    const handleFocusIn = () => setFocused(true)
    const handleFocusOut = (e: FocusEvent) => {
      // Check if focus is leaving the container
      if (!container.contains(e.relatedTarget as Node)) {
        setFocused(false)
      }
    }

    container.addEventListener('focusin', handleFocusIn)
    container.addEventListener('focusout', handleFocusOut)

    // Initial check
    setFocused(isFocusWithin(container))

    return () => {
      container.removeEventListener('focusin', handleFocusIn)
      container.removeEventListener('focusout', handleFocusOut)
    }
  }, [])

  return [ref, focused]
}

/**
 * Hook to auto-focus an element when component mounts
 *
 * @example
 * function Dialog() {
 *   const inputRef = useAutoFocus()
 *   return <input ref={inputRef} />
 * }
 */
export function useAutoFocus<T extends HTMLElement = HTMLElement>(
  enabled: boolean = true,
  options?: {
    preventScroll?: boolean
    delay?: number
  }
): RefObject<T> {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!enabled || !ref.current) return

    const focus = () => {
      ref.current?.focus({ preventScroll: options?.preventScroll })
    }

    if (options?.delay) {
      const timeout = setTimeout(focus, options.delay)
      return () => clearTimeout(timeout)
    } else {
      focus()
    }
  }, [enabled, options?.preventScroll, options?.delay])

  return ref
}

/**
 * Hook to track focus state of an element
 *
 * @example
 * function Input() {
 *   const [ref, isFocused] = useFocusState()
 *
 *   return (
 *     <input
 *       ref={ref}
 *       className={isFocused ? 'focused' : ''}
 *     />
 *   )
 * }
 */
export function useFocusState<T extends HTMLElement = HTMLElement>(): [
  RefObject<T>,
  boolean
] {
  const ref = useRef<T>(null)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const handleFocus = () => setIsFocused(true)
    const handleBlur = () => setIsFocused(false)

    element.addEventListener('focus', handleFocus)
    element.addEventListener('blur', handleBlur)

    // Initial check
    setIsFocused(element === document.activeElement)

    return () => {
      element.removeEventListener('focus', handleFocus)
      element.removeEventListener('blur', handleBlur)
    }
  }, [])

  return [ref, isFocused]
}

/**
 * Hook to get all focusable elements within a container
 *
 * @example
 * function Container() {
 *   const [ref, focusableElements] = useFocusableElements()
 *
 *   console.log('Focusable elements:', focusableElements.length)
 *
 *   return <div ref={ref}>...</div>
 * }
 */
export function useFocusableElements<T extends HTMLElement = HTMLElement>(): [
  RefObject<T>,
  HTMLElement[]
] {
  const ref = useRef<T>(null)
  const [elements, setElements] = useState<HTMLElement[]>([])

  useEffect(() => {
    if (!ref.current) return

    const updateElements = () => {
      setElements(getFocusableElements(ref.current))
    }

    // Initial update
    updateElements()

    // Update on DOM changes
    const observer = new MutationObserver(updateElements)
    observer.observe(ref.current, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'tabindex'],
    })

    return () => {
      observer.disconnect()
    }
  }, [])

  return [ref, elements]
}

/**
 * Hook to set up focus-visible polyfill
 * Adds [data-focus-visible] attribute for styling keyboard focus
 *
 * @example
 * function App() {
 *   useFocusVisible()
 *   return <div>...</div>
 * }
 *
 * // In CSS:
 * // button[data-focus-visible] {
 * //   outline: 2px solid blue;
 * // }
 */
export function useFocusVisible(): void {
  useEffect(() => {
    const cleanup = setupFocusVisible()
    return cleanup
  }, [])
}

/**
 * Hook to handle keyboard navigation
 *
 * @example
 * function List() {
 *   const handleKeyDown = useKeyboardNav({
 *     onEnter: () => selectItem(),
 *     onEscape: () => closeList(),
 *     onArrowDown: () => moveNext(),
 *     onArrowUp: () => movePrevious(),
 *   })
 *
 *   return <div onKeyDown={handleKeyDown}>...</div>
 * }
 */
export function useKeyboardNav(handlers: {
  onEnter?: () => void
  onSpace?: () => void
  onEscape?: () => void
  onArrowUp?: () => void
  onArrowDown?: () => void
  onArrowLeft?: () => void
  onArrowRight?: () => void
  onHome?: () => void
  onEnd?: () => void
  onTab?: () => void
  onShiftTab?: () => void
}): (e: React.KeyboardEvent) => void {
  return useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          if (handlers.onEnter) {
            e.preventDefault()
            handlers.onEnter()
          }
          break
        case ' ':
          if (handlers.onSpace) {
            e.preventDefault()
            handlers.onSpace()
          }
          break
        case 'Escape':
          if (handlers.onEscape) {
            e.preventDefault()
            handlers.onEscape()
          }
          break
        case 'ArrowUp':
          if (handlers.onArrowUp) {
            e.preventDefault()
            handlers.onArrowUp()
          }
          break
        case 'ArrowDown':
          if (handlers.onArrowDown) {
            e.preventDefault()
            handlers.onArrowDown()
          }
          break
        case 'ArrowLeft':
          if (handlers.onArrowLeft) {
            e.preventDefault()
            handlers.onArrowLeft()
          }
          break
        case 'ArrowRight':
          if (handlers.onArrowRight) {
            e.preventDefault()
            handlers.onArrowRight()
          }
          break
        case 'Home':
          if (handlers.onHome) {
            e.preventDefault()
            handlers.onHome()
          }
          break
        case 'End':
          if (handlers.onEnd) {
            e.preventDefault()
            handlers.onEnd()
          }
          break
        case 'Tab':
          if (e.shiftKey && handlers.onShiftTab) {
            e.preventDefault()
            handlers.onShiftTab()
          } else if (handlers.onTab) {
            e.preventDefault()
            handlers.onTab()
          }
          break
      }
    },
    [handlers]
  )
}
