'use client'

import * as React from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { accessibilitySettingsService } from '@/lib/services/AccessibilitySettingsService'
import { cn } from '@/lib/utils'

export interface HighContrastToggleProps {
  className?: string
  showLabel?: boolean
  label?: string
}

export function HighContrastToggle({
  className,
  showLabel = true,
  label = 'High contrast mode',
}: HighContrastToggleProps) {
  const [enabled, setEnabled] = React.useState(false)

  React.useEffect(() => {
    // Subscribe to settings changes
    const unsubscribe = accessibilitySettingsService.subscribe((settings) => {
      setEnabled(settings.highContrast)
    })

    return unsubscribe
  }, [])

  const handleToggle = (checked: boolean) => {
    accessibilitySettingsService.setHighContrast(checked)
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Switch
        id="high-contrast-toggle"
        checked={enabled}
        onCheckedChange={handleToggle}
        aria-label={label}
        aria-describedby="high-contrast-description"
      />
      {showLabel && (
        <Label
          htmlFor="high-contrast-toggle"
          className="cursor-pointer"
        >
          {label}
        </Label>
      )}
      <span id="high-contrast-description" className="sr-only">
        {enabled
          ? 'High contrast mode is enabled. Text and backgrounds have increased contrast for better visibility.'
          : 'High contrast mode is disabled. Enable to increase contrast for better visibility.'}
      </span>
    </div>
  )
}

