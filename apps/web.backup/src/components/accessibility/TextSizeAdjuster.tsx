'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { fontSizeScalingService } from '@/lib/services/FontSizeScalingService'
import { cn } from '@/lib/utils'
import { Minus, Plus, RotateCcw } from 'lucide-react'

export interface TextSizeAdjusterProps {
  className?: string
  showLabel?: boolean
  showReset?: boolean
  label?: string
}

export function TextSizeAdjuster({
  className,
  showLabel = true,
  showReset = true,
  label = 'Text size',
}: TextSizeAdjusterProps) {
  const [scale, setScale] = React.useState(1)
  const [announcement, setAnnouncement] = React.useState('')

  React.useEffect(() => {
    // Subscribe to scale changes
    const unsubscribe = fontSizeScalingService.subscribe((currentScale) => {
      setScale(currentScale)
      const percentage = Math.round(currentScale * 100)
      setAnnouncement(`Text size set to ${percentage}%`)
    })

    return unsubscribe
  }, [])

  const handleDecrease = () => {
    fontSizeScalingService.decrease()
  }

  const handleIncrease = () => {
    fontSizeScalingService.increase()
  }

  const handleReset = () => {
    fontSizeScalingService.reset()
  }

  const percentage = Math.round(scale * 100)
  const canDecrease = scale > fontSizeScalingService.getMinScale()
  const canIncrease = scale < fontSizeScalingService.getMaxScale()
  const isDefault = scale === 1

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {showLabel && (
        <Label id="text-size-label">{label}</Label>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleDecrease}
          disabled={!canDecrease}
          aria-label="Decrease text size"
          aria-describedby="text-size-label"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span
          className="min-w-[4rem] text-center text-sm font-medium"
          aria-live="polite"
          aria-atomic="true"
        >
          {percentage}%
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleIncrease}
          disabled={!canIncrease}
          aria-label="Increase text size"
          aria-describedby="text-size-label"
        >
          <Plus className="h-4 w-4" />
        </Button>
        {showReset && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleReset}
            disabled={isDefault}
            aria-label="Reset text size to default"
            aria-describedby="text-size-label"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>
      {/* Screen reader announcement */}
      {announcement && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {announcement}
        </div>
      )}
    </div>
  )
}

