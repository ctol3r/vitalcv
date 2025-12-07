'use client'

/**
 * B247C-GAM-029: PointsProgressBar component
 *
 * Visualizes progress towards next level or badge; displays current points, next threshold, and percentage;
 * animates smoothly; uses design tokens; accessible progress bar semantics
 */

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface PointsProgressBarProps {
  currentPoints: number
  nextThreshold: number
  showLabels?: boolean
  showPercentage?: boolean
  size?: 'small' | 'medium' | 'large'
  className?: string
}

const sizeClasses = {
  small: 'h-2',
  medium: 'h-3',
  large: 'h-4',
}

export function PointsProgressBar({
  currentPoints,
  nextThreshold,
  showLabels = true,
  showPercentage = true,
  size = 'medium',
  className,
}: PointsProgressBarProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0)

  const progress = Math.min(100, Math.max(0, (currentPoints / nextThreshold) * 100))
  const pointsRemaining = Math.max(0, nextThreshold - currentPoints)

  useEffect(() => {
    // Animate progress bar
    const duration = 1000 // 1 second
    const steps = 60
    const stepDuration = duration / steps
    let currentStep = 0

    const interval = setInterval(() => {
      currentStep++
      const stepProgress = (currentStep / steps) * progress
      setAnimatedProgress(stepProgress)

      if (currentStep >= steps) {
        clearInterval(interval)
        setAnimatedProgress(progress)
      }
    }, stepDuration)

    return () => clearInterval(interval)
  }, [progress])

  const formatPoints = (points: number): string => {
    if (points >= 1000000) {
      return `${(points / 1000000).toFixed(1)}M`
    }
    if (points >= 1000) {
      return `${(points / 1000).toFixed(1)}K`
    }
    return points.toString()
  }

  return (
    <div className={cn('w-full', className)}>
      {showLabels && (
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm">
            <span className="font-semibold">{formatPoints(currentPoints)}</span>
            <span className="text-muted-foreground"> / {formatPoints(nextThreshold)} points</span>
          </div>
          {showPercentage && (
            <div className="text-sm font-medium text-muted-foreground">
              {Math.round(progress)}%
            </div>
          )}
        </div>
      )}

      <div
        className={cn(
          'w-full bg-muted rounded-full overflow-hidden',
          sizeClasses[size]
        )}
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress: ${Math.round(progress)}% towards next level`}
      >
        <div
          className={cn(
            'h-full bg-primary transition-all duration-1000 ease-out rounded-full',
            'flex items-center justify-end pr-2'
          )}
          style={{ width: `${animatedProgress}%` }}
        >
          {size === 'large' && animatedProgress > 10 && (
            <span className="text-xs text-primary-foreground font-medium">
              {Math.round(animatedProgress)}%
            </span>
          )}
        </div>
      </div>

      {pointsRemaining > 0 && showLabels && (
        <div className="mt-2 text-xs text-muted-foreground">
          {formatPoints(pointsRemaining)} points remaining to next level
        </div>
      )}

      {progress >= 100 && (
        <div className="mt-2 text-sm font-semibold text-primary">
          Level up! 🎉
        </div>
      )}
    </div>
  )
}

