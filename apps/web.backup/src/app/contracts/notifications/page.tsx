'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Bell,
  CheckCircle2,
  Circle,
  Filter,
  FileText,
  Users,
  Calendar,
  AlertCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

type NotificationType = 'CONTRACT_CREATED' | 'CONTRACT_SIGNED' | 'SIGNATURE_PENDING' | 'MILESTONE_DUE' | 'MILESTONE_OVERDUE' | 'CHANGE_REQUEST' | 'CONTRACT_EXPIRING' | 'CONTRACT_EXPIRED'

interface ContractNotification {
  id: string
  type: NotificationType
  message: string
  contractId: string
  contractTitle: string
  read: boolean
  createdAt: string
}

export default function ContractNotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<ContractNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')

  useEffect(() => {
    loadNotifications()
  }, [filter])

  async function loadNotifications() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filter === 'unread') {
        params.append('unread', 'true')
      }
      const response = await fetch(`/api/contracts/notifications?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to load notifications (${response.status})`)
      }
      const data = await response.json()
      setNotifications(data.notifications || [])
      setError(null)
    } catch (err: any) {
      setError(err.message ?? 'Unable to load notifications')
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      const response = await fetch(`/api/contracts/notifications/${notificationId}/read`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to mark notification as read')
      }
      loadNotifications()
    } catch (err: any) {
      setError(err.message ?? 'Failed to mark notification as read')
    }
  }

  async function markAllAsRead() {
    try {
      const response = await fetch('/api/contracts/notifications/read-all', {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read')
      }
      loadNotifications()
    } catch (err: any) {
      setError(err.message ?? 'Failed to mark all notifications as read')
    }
  }

  function getNotificationIcon(type: NotificationType) {
    switch (type) {
      case 'CONTRACT_CREATED':
      case 'CONTRACT_SIGNED':
        return <FileText className="h-5 w-5" />
      case 'SIGNATURE_PENDING':
        return <Users className="h-5 w-5" />
      case 'MILESTONE_DUE':
      case 'MILESTONE_OVERDUE':
        return <Calendar className="h-5 w-5" />
      case 'CHANGE_REQUEST':
        return <AlertCircle className="h-5 w-5" />
      case 'CONTRACT_EXPIRING':
      case 'CONTRACT_EXPIRED':
        return <AlertCircle className="h-5 w-5" />
      default:
        return <Bell className="h-5 w-5" />
    }
  }

  function getNotificationBadge(type: NotificationType) {
    const variants: Record<NotificationType, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
      CONTRACT_CREATED: { variant: 'default', label: 'Created' },
      CONTRACT_SIGNED: { variant: 'default', label: 'Signed' },
      SIGNATURE_PENDING: { variant: 'secondary', label: 'Signature Pending' },
      MILESTONE_DUE: { variant: 'outline', label: 'Milestone Due' },
      MILESTONE_OVERDUE: { variant: 'destructive', label: 'Overdue' },
      CHANGE_REQUEST: { variant: 'secondary', label: 'Change Request' },
      CONTRACT_EXPIRING: { variant: 'outline', label: 'Expiring Soon' },
      CONTRACT_EXPIRED: { variant: 'destructive', label: 'Expired' },
    }
    const { variant, label } = variants[type]
    return <Badge variant={variant}>{label}</Badge>
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString()
  }

  const unreadCount = notifications.filter(n => !n.read).length
  const filteredNotifications = filter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="py-16 text-center text-muted-foreground">Loading notifications…</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bell className="h-7 w-7 text-primary" aria-hidden="true" />
              Contract Notifications
            </h1>
            <p className="text-muted-foreground max-w-2xl mt-2">
              View and manage contract-related notifications
            </p>
          </div>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" onClick={markAllAsRead}>
                Mark All as Read
              </Button>
            )}
            <Button variant="outline" onClick={loadNotifications}>
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <Card className="border-destructive" role="alert">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label htmlFor="filter">Filter</Label>
            <Select value={filter} onValueChange={(value) => setFilter(value as 'all' | 'unread')}>
              <SelectTrigger id="filter" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Notifications</SelectItem>
                <SelectItem value="unread">
                  Unread ({unreadCount})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredNotifications.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredNotifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                    !notification.read ? 'border-l-4 border-l-primary' : ''
                  }`}
                  onClick={() => {
                    if (!notification.read) {
                      markAsRead(notification.id)
                    }
                    router.push(`/contracts/${notification.contractId}`)
                  }}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {getNotificationBadge(notification.type)}
                              {!notification.read && (
                                <Circle className="h-2 w-2 fill-primary text-primary" />
                              )}
                            </div>
                            <p className="font-medium">{notification.message}</p>
                            <Link
                              href={`/contracts/${notification.contractId}`}
                              className="text-sm text-muted-foreground hover:underline mt-1 block"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {notification.contractTitle}
                            </Link>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(notification.createdAt)}
                          </div>
                        </div>
                      </div>
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            markAsRead(notification.id)
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

