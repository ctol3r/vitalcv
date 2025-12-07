'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ScreenReaderOnlyLabelProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'span' | 'div' | 'label' | 'p'
  children: React.ReactNode
}

/**
 * ScreenReaderOnlyLabel component
 *
 * Provides hidden labels and descriptions for complex widgets that are
 * visible to screen readers only. This ensures proper ARIA relationships
 * without cluttering the visual interface.
 *
 * Usage:
 * ```tsx
 * <ScreenReaderOnlyLabel id="my-label">
 *   Detailed description for screen readers
 * </ScreenReaderOnlyLabel>
 * <input aria-labelledby="my-label" />
 * ```
 *
 * Guidelines:
 * - Use for complex widgets that need additional context
 * - Always provide an id when using with aria-labelledby or aria-describedby
 * - Keep text concise but descriptive
 * - Don't use for essential visual information
 */
export function ScreenReaderOnlyLabel({
  as: Component = 'span',
  className,
  children,
  ...props
}: ScreenReaderOnlyLabelProps) {
  return (
    <Component
      className={cn(
        'sr-only',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  )
}

