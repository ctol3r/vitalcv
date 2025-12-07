'use client'

/**
 * B247C-GAM-026: AchievementBadge UI component
 *
 * Displays badge icon, name, level, and description; supports earned/unearned states;
 * tooltip to show criteria; responsive design; integrates with design system tokens; accessible with ARIA
 */

import { useState } from 'react'
import { Award, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Badge {
  id: string
  name: string
  slug: string
  description?: string
  iconId?: string
  level: number
  criteria?: any
}

interface AchievementBadgeProps {
  badge: Badge
  earned?: boolean
  showTooltip?: boolean
  size?: 'small' | 'medium' | 'large'
  className?: string
}

const sizeClasses = {
  small: 'w-16 h-16 text-xs',
  medium: 'w-24 h-24 text-sm',
  large: 'w-32 h-32 text-base',
}

const iconSizes = {
  small: 'w-8 h-8',
  medium: 'w-12 h-12',
  large: 'w-16 h-16',
}

export function AchievementBadge({
  badge,
  earned = false,
  showTooltip = false,
  size = 'medium',
  className,
}: AchievementBadgeProps) {
  const [showTooltipState, setShowTooltipState] = useState(false)

  const badgeClasses = cn(
    'relative flex flex-col items-center justify-center rounded-full border-2 transition-all',
    earned
      ? 'bg-primary/10 border-primary text-primary shadow-md hover:shadow-lg'
      : 'bg-muted border-muted-foreground/30 text-muted-foreground opacity-60',
    sizeClasses[size],
    className
  )

  const tooltipContent = badge.criteria
    ? `Criteria: ${JSON.stringify(badge.criteria, null, 2)}`
    : badge.description || 'No description available'

  return (
    <div className="relative inline-block">
      <div
        className={badgeClasses}
        role="img"
        aria-label={earned ? `Earned badge: ${badge.name}` : `Badge: ${badge.name} (not earned)`}
        aria-describedby={showTooltip && showTooltipState ? `badge-tooltip-${badge.id}` : undefined}
        onMouseEnter={() => showTooltip && setShowTooltipState(true)}
        onMouseLeave={() => setShowTooltipState(false)}
        onFocus={() => showTooltip && setShowTooltipState(true)}
        onBlur={() => setShowTooltipState(false)}
        tabIndex={0}
      >
        {earned ? (
          badge.iconId ? (
            <img
              src={`/icons/badges/${badge.iconId}.svg`}
              alt={badge.name}
              className={iconSizes[size]}
              onError={(e) => {
                // Fallback to default icon if image fails to load
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <Award className={iconSizes[size]} aria-hidden="true" />
          )
        ) : (
          <Lock className={iconSizes[size]} aria-hidden="true" />
        )}
        {badge.level > 1 && (
          <span
            className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold"
            aria-label={`Level ${badge.level}`}
          >
            {badge.level}
          </span>
        )}
      </div>

      {/* Badge Name */}
      <div className="mt-2 text-center">
        <p
          className={cn(
            'text-xs font-medium truncate max-w-full',
            earned ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          {badge.name}
        </p>
      </div>

      {/* Tooltip */}
      {showTooltip && showTooltipState && (
        <div
          id={`badge-tooltip-${badge.id}`}
          className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-popover text-popover-foreground rounded-lg shadow-lg border text-sm"
          role="tooltip"
        >
          <p className="font-semibold mb-1">{badge.name}</p>
          {badge.description && <p className="text-muted-foreground mb-2">{badge.description}</p>}
          {badge.level > 1 && (
            <p className="text-xs text-muted-foreground">Level {badge.level}</p>
          )}
          {badge.criteria && (
            <details className="mt-2">
              <summary className="text-xs cursor-pointer text-muted-foreground">
                View Criteria
              </summary>
              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                {tooltipContent}
              </pre>
            </details>
          )}
          <div
            className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-popover"
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  )
}

