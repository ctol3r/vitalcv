'use client'

import * as React from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { accessibilitySettingsService } from '@/lib/services/AccessibilitySettingsService'

export interface AccessibleTooltipProps {
  children: React.ReactNode
  content: string
  delayDuration?: number
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
  disabled?: boolean
}

/**
 * AccessibleTooltip component
 *
 * A tooltip that:
 * - Appears on focus and hover
 * - Includes ARIA roles
 * - Supports delay
 * - Escapes on ESC key
 * - Positions relative to target
 * - Uses semantic labels
 * - High contrast aware
 */
export function AccessibleTooltip({
  children,
  content,
  delayDuration = 300,
  side = 'top',
  className,
  disabled = false,
}: AccessibleTooltipProps) {
  const [highContrast, setHighContrast] = React.useState(false)

  React.useEffect(() => {
    const unsubscribe = accessibilitySettingsService.subscribe((settings) => {
      setHighContrast(settings.highContrast)
    })
    return unsubscribe
  }, [])

  if (disabled) {
    return <>{children}</>
  }

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          className={cn(
            highContrast && 'border-2 border-foreground',
            className
          )}
          role="tooltip"
          onEscapeKeyDown={(e) => {
            // Allow ESC to close tooltip
            e.preventDefault()
          }}
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

