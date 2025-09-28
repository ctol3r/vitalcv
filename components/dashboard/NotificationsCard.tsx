"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Bell, AlertTriangle, CheckCircle, Info, Clock } from "lucide-react"

interface Notification {
  id: number
  type: "info" | "warning" | "update"
  message: string
  timestamp: string
  actionRequired: boolean
}

interface NotificationsCardProps {
  notifications: Notification[]
  onReview?: (notificationId: number) => void
}

export function NotificationsCard({ notifications, onReview }: NotificationsCardProps) {
  const getNotificationConfig = (type: string) => {
    switch (type) {
      case "warning":
        return {
          icon: <AlertTriangle className="h-4 w-4 text-orange-600" />,
          borderColor: "border-l-orange-500",
          bgColor: "bg-orange-50/50",
        }
      case "update":
        return {
          icon: <Bell className="h-4 w-4 text-blue-600" />,
          borderColor: "border-l-blue-500",
          bgColor: "bg-blue-50/50",
        }
      case "info":
        return {
          icon: <CheckCircle className="h-4 w-4 text-green-600" />,
          borderColor: "border-l-green-500",
          bgColor: "bg-green-50/50",
        }
      default:
        return {
          icon: <Info className="h-4 w-4 text-gray-600" />,
          borderColor: "border-l-gray-500",
          bgColor: "bg-gray-50/50",
        }
    }
  }

  const formatTimestamp = (timestamp: string) => {
    // Handle relative timestamps like "2 hours ago" or absolute dates
    if (timestamp.includes("ago") || timestamp.includes("day")) {
      return timestamp
    }

    try {
      const date = new Date(timestamp)
      const now = new Date()
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

      if (diffInHours < 1) return "Just now"
      if (diffInHours < 24) return `${diffInHours} hours ago`
      if (diffInHours < 48) return "1 day ago"
      return `${Math.floor(diffInHours / 24)} days ago`
    } catch {
      return timestamp
    }
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-200">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Bell className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">Notifications</CardTitle>
            <CardDescription className="text-sm">Recent updates and alerts</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const config = getNotificationConfig(notification.type)
              return (
                <Alert
                  key={notification.id}
                  className={`border-l-4 ${config.borderColor} ${config.bgColor} transition-all duration-200 hover:shadow-sm`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
                    <div className="flex-1 min-w-0">
                      <AlertDescription className="text-sm text-gray-900 mb-3 leading-relaxed">
                        {notification.message}
                      </AlertDescription>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimestamp(notification.timestamp)}</span>
                        </div>
                        {notification.actionRequired && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 bg-white/80 hover:bg-white border-gray-300 self-start sm:self-auto"
                            onClick={() => onReview?.(notification.id)}
                          >
                            Review
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Alert>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
