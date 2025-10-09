/**
 * Visually Hidden Component
 *
 * Hides content visually but keeps it accessible to screen readers
 * Also known as "screen reader only" (sr-only)
 */

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * VisuallyHidden Component
 *
 * Content is hidden from visual users but announced by screen readers
 *
 * @example
 * <button>
 *   <Icon />
 *   <VisuallyHidden>Close dialog</VisuallyHidden>
 * </button>
 */
export function VisuallyHidden({
  children,
  className,
  ...props
}: {
  children: ReactNode
  className?: string
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0',
        className
      )}
      style={{
        clip: 'rect(0, 0, 0, 0)',
        clipPath: 'inset(50%)',
      }}
      {...props}
    >
      {children}
    </span>
  )
}

/**
 * FocusableVisuallyHidden Component
 *
 * Hidden by default, but visible when focused (useful for skip links)
 *
 * @example
 * <FocusableVisuallyHidden>
 *   <a href="#main-content">Skip to main content</a>
 * </FocusableVisuallyHidden>
 */
export function FocusableVisuallyHidden({
  children,
  className,
  ...props
}: {
  children: ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'sr-only focus-within:not-sr-only focus-within:absolute focus-within:top-4 focus-within:left-4 focus-within:z-50',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
