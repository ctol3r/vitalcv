'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SkipToContentLinkProps {
  targetId?: string
  label?: string
  className?: string
}

/**
 * SkipToContentLink component
 *
 * Provides a skip link for keyboard users to jump directly to main content.
 * The link is hidden by default and appears when focused.
 *
 * Usage:
 * ```tsx
 * <SkipToContentLink targetId="main-content" />
 * <main id="main-content">...</main>
 * ```
 */
export function SkipToContentLink({
  targetId = 'main-content',
  label = 'Skip to main content',
  className,
}: SkipToContentLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        'absolute left-[-9999px] z-[999] rounded-md bg-primary px-4 py-2 text-primary-foreground no-underline transition-all focus:left-4 focus:top-4',
        className
      )}
      onClick={(e) => {
        e.preventDefault()
        const target = document.getElementById(targetId)
        if (target) {
          target.focus()
          target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }}
    >
      {label}
    </a>
  )
}

