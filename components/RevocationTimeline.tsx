"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, FileCheck, XCircle, Clock } from "lucide-react"
import { format } from "date-fns"

export interface TimelineEvent {
  type: "issued" | "verified" | "revoked"
  timestamp: string
  auditRef?: string
  details?: string
}

interface RevocationTimelineProps {
  credentialId: string
  events: TimelineEvent[]
  className?: string
}

export function RevocationTimeline({ credentialId, events, className = "" }: RevocationTimelineProps) {
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  const getEventConfig = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "issued":
        return {
          icon: <CheckCircle className="h-5 w-5" />,
          color: "text-green-600",
          bgColor: "bg-green-100",
          borderColor: "border-green-300",
          label: "Issued",
          badgeVariant: "default" as const,
        }
      case "verified":
        return {
          icon: <FileCheck className="h-5 w-5" />,
          color: "text-blue-600",
          bgColor: "bg-blue-100",
          borderColor: "border-blue-300",
          label: "Verified",
          badgeVariant: "default" as const,
        }
      case "revoked":
        return {
          icon: <XCircle className="h-5 w-5" />,
          color: "text-red-600",
          bgColor: "bg-red-100",
          borderColor: "border-red-300",
          label: "Revoked",
          badgeVariant: "destructive" as const,
        }
    }
  }

  if (events.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Event Timeline</CardTitle>
          <CardDescription>No events recorded for this credential</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Timeline will update as events occur</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Event Timeline</CardTitle>
        <CardDescription>
          Chronological history for credential <span className="font-mono text-xs">{credentialId}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-4">
          {sortedEvents.map((event, index) => {
            const config = getEventConfig(event.type)
            const isLast = index === sortedEvents.length - 1

            return (
              <div key={`${event.type}-${event.timestamp}-${index}`} className="relative flex gap-4">
                {/* Timeline line */}
                {!isLast && (
                  <div
                    className="absolute left-[18px] top-10 bottom-0 w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                )}

                {/* Event icon */}
                <div
                  className={`relative z-10 flex items-center justify-center w-9 h-9 rounded-full ${config.bgColor} ${config.borderColor} border-2`}
                >
                  <div className={config.color}>{config.icon}</div>
                </div>

                {/* Event content */}
                <div className="flex-1 pb-6">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={config.badgeVariant} className="text-xs">
                        {config.label}
                      </Badge>
                      <time className="text-sm text-gray-500" dateTime={event.timestamp}>
                        {format(new Date(event.timestamp), "MMM d, yyyy 'at' h:mm a")}
                      </time>
                    </div>
                  </div>

                  {event.auditRef && (
                    <div className="mt-2">
                      <span className="text-xs text-gray-500">Audit Ref: </span>
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{event.auditRef}</code>
                    </div>
                  )}

                  {event.details && (
                    <p className="text-sm text-gray-600 mt-2">{event.details}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
