'use client'

/**
 * B234C-COMM-014: NotificationsPanel UI
 *
 * Shows recent community notifications (mentions, replies, follows);
 * allows marking as read, filtering by type; links to relevant threads
 */

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Bell,
  MessageSquare,
  UserPlus,
  AtSign,
  Check,
  CheckCheck,
  X,
  Filter,
} from 'lucide-react'

export type NotificationType = 'mention' | 'reply' | 'follow' | 'all'

interface Notification {
  id: string
  type: 'mention' | 'reply' | 'follow'
  title: string
  message: string
  link: string
  read: boolean
  createdAt: string
  actor?: {
    id: string
    name: string
    avatar?: string
  }
}

interface NotificationsPanelProps {
  notifications?: Notification[]
  onMarkAsRead?: (id: string) => void
  onMarkAllAsRead?: () => void
  onDismiss?: (id: string) => void
  className?: string
}

// Mock data - replace with API call
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'reply',
    title: 'New reply to your post',
    message: 'John Martinez replied to "How to streamline credentialing workflow?"',
    link: '/community/posts/1',
    read: false,
    createdAt: '2025-11-16T09:00:00Z',
    actor: {
      id: '2',
      name: 'John Martinez',
    },
  },
  {
    id: '2',
    type: 'mention',
    title: 'You were mentioned',
    message: 'Dr. Sarah Chen mentioned you in a comment',
    link: '/community/posts/2',
    read: false,
    createdAt: '2025-11-16T08:30:00Z',
    actor: {
      id: '1',
      name: 'Dr. Sarah Chen',
    },
  },
  {
    id: '3',
    type: 'follow',
    title: 'New follower',
    message: 'Alex Kim started following you',
    link: '/community/users/alex-kim',
    read: true,
    createdAt: '2025-11-16T07:00:00Z',
    actor: {
      id: '3',
      name: 'Alex Kim',
    },
  },
  {
    id: '4',
    type: 'reply',
    title: 'New reply to your comment',
    message: 'Dr. Sarah Chen replied to your comment on "Best practices for document verification"',
    link: '/community/posts/2',
    read: false,
    createdAt: '2025-11-16T06:00:00Z',
    actor: {
      id: '1',
      name: 'Dr. Sarah Chen',
    },
  },
]

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'mention':
      return <AtSign className="h-4 w-4" />
    case 'reply':
      return <MessageSquare className="h-4 w-4" />
    case 'follow':
      return <UserPlus className="h-4 w-4" />
    default:
      return <Bell className="h-4 w-4" />
  }
}

const getNotificationColor = (type: Notification['type']) => {
  switch (type) {
    case 'mention':
      return 'text-blue-500 bg-blue-50 dark:bg-blue-950'
    case 'reply':
      return 'text-green-500 bg-green-50 dark:bg-green-950'
    case 'follow':
      return 'text-purple-500 bg-purple-50 dark:bg-purple-950'
    default:
      return 'text-muted-foreground bg-muted'
  }
}

export function NotificationsPanel({
  notifications = mockNotifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  className,
}: NotificationsPanelProps) {
  const [filter, setFilter] = useState<NotificationType>('all')
  const [localNotifications, setLocalNotifications] = useState(notifications)

  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return localNotifications
    return localNotifications.filter((n) => n.type === filter)
  }, [localNotifications, filter])

  const unreadCount = useMemo(() => {
    return localNotifications.filter((n) => !n.read).length
  }, [localNotifications])

  const handleMarkAsRead = (id: string) => {
    setLocalNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    onMarkAsRead?.(id)
  }

  const handleMarkAllAsRead = () => {
    setLocalNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    onMarkAllAsRead?.()
  }

  const handleDismiss = (id: string) => {
    setLocalNotifications((prev) => prev.filter((n) => n.id !== id))
    onDismiss?.(id)
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Notifications</CardTitle>
            {unreadCount > 0 && (
              <Badge variant="default" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all as read
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as NotificationType)}>
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="all" className="relative">
              All
              {localNotifications.filter((n) => !n.read).length > 0 && (
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full" />
              )}
            </TabsTrigger>
            <TabsTrigger value="mention" className="relative">
              Mentions
              {localNotifications.filter((n) => n.type === 'mention' && !n.read).length > 0 && (
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-blue-500 rounded-full" />
              )}
            </TabsTrigger>
            <TabsTrigger value="reply" className="relative">
              Replies
              {localNotifications.filter((n) => n.type === 'reply' && !n.read).length > 0 && (
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
              )}
            </TabsTrigger>
            <TabsTrigger value="follow" className="relative">
              Follows
              {localNotifications.filter((n) => n.type === 'follow' && !n.read).length > 0 && (
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-purple-500 rounded-full" />
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-0">
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No notifications</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      notification.read
                        ? 'bg-background'
                        : 'bg-primary/5 border-primary/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-full ${getNotificationColor(
                          notification.type
                        )} shrink-0`}
                      >
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={notification.link}
                          className="block hover:underline"
                          onClick={() => !notification.read && handleMarkAsRead(notification.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-sm">{notification.title}</p>
                                {!notification.read && (
                                  <span className="h-2 w-2 bg-primary rounded-full shrink-0" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-1">
                                {notification.message}
                              </p>
                              {notification.actor && (
                                <p className="text-xs text-muted-foreground">
                                  by {notification.actor.name}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatTimeAgo(notification.createdAt)}
                              </p>
                            </div>
                          </div>
                        </Link>
                        <div className="flex items-center gap-2 mt-2">
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="h-7 text-xs"
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Mark as read
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDismiss(notification.id)}
                            className="h-7 text-xs"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

