'use client'

/**
 * B247C-GAM-027: RewardsNotification UI
 *
 * Provides toast/modal to announce newly earned points or badges; shows message, point amount or badge name;
 * automatically disappears after duration; integrates with event bus for real-time notifications
 */

import { useEffect, useState } from 'react'
import { X, Trophy, Award, CheckCircle } from 'lucide-react'
import { Button } from '@/components/design/Button'
import { cn } from '@/lib/utils'

export type NotificationType = 'points' | 'badge' | 'level'

export interface RewardsNotificationData {
  type: NotificationType
  message?: string
  points?: number
  badge?: {
    id: string
    name: string
    iconId?: string
  }
  duration?: number
}

interface RewardsNotificationProps {
  notification: RewardsNotificationData
  onClose: () => void
  className?: string
}

export function RewardsNotification({
  notification,
  onClose,
  className,
}: RewardsNotificationProps) {
  const [isVisible, setIsVisible] = useState(true)
  const duration = notification.duration || 5000

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300) // Wait for fade-out animation
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const formatPoints = (points: number): string => {
    if (points >= 1000) {
      return `${(points / 1000).toFixed(1)}K`
    }
    return points.toString()
  }

  const getIcon = () => {
    switch (notification.type) {
      case 'points':
        return <Trophy className="w-6 h-6" />
      case 'badge':
        return <Award className="w-6 h-6" />
      case 'level':
        return <CheckCircle className="w-6 h-6" />
      default:
        return <Trophy className="w-6 h-6" />
    }
  }

  const getTitle = () => {
    switch (notification.type) {
      case 'points':
        return notification.message || 'Points Earned!'
      case 'badge':
        return notification.message || 'Badge Earned!'
      case 'level':
        return notification.message || 'Level Up!'
      default:
        return 'Reward Earned!'
    }
  }

  const getContent = () => {
    if (notification.type === 'points' && notification.points) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-primary">+{formatPoints(notification.points)}</span>
          <span className="text-sm text-muted-foreground">points</span>
        </div>
      )
    }

    if (notification.type === 'badge' && notification.badge) {
      return (
        <div className="flex items-center gap-3">
          {notification.badge.iconId ? (
            <img
              src={`/icons/badges/${notification.badge.iconId}.svg`}
              alt={notification.badge.name}
              className="w-8 h-8"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <Award className="w-8 h-8 text-primary" />
          )}
          <div>
            <p className="font-semibold">{notification.badge.name}</p>
            <p className="text-sm text-muted-foreground">New badge earned!</p>
          </div>
        </div>
      )
    }

    return <p className="text-sm">{notification.message}</p>
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 max-w-sm w-full sm:w-auto',
        'transform transition-all duration-300 ease-in-out',
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        className
      )}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="bg-card border rounded-lg shadow-lg p-4 flex items-start gap-4">
        <div className="flex-shrink-0 text-primary">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold mb-1">{getTitle()}</h3>
          {getContent()}
        </div>
        <Button
          variant="ghost"
          size="small"
          onClick={() => {
            setIsVisible(false)
            setTimeout(onClose, 300)
          }}
          className="flex-shrink-0"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

// Hook for managing notifications
export function useRewardsNotifications() {
  const [notifications, setNotifications] = useState<RewardsNotificationData[]>([])

  const addNotification = (notification: RewardsNotificationData) => {
    setNotifications((prev) => [...prev, notification])
  }

  const removeNotification = (index: number) => {
    setNotifications((prev) => prev.filter((_, i) => i !== index))
  }

  // Listen for reward events (integrate with event bus)
  useEffect(() => {
    // Example: Listen to window events or event bus
    const handleRewardEvent = (event: CustomEvent<RewardsNotificationData>) => {
      addNotification(event.detail)
    }

    window.addEventListener('reward-earned', handleRewardEvent as EventListener)

    return () => {
      window.removeEventListener('reward-earned', handleRewardEvent as EventListener)
    }
  }, [])

  return {
    notifications,
    addNotification,
    removeNotification,
  }
}

