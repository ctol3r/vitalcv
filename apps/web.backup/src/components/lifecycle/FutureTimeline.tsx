'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Calendar, Clock, TrendingUp, AlertCircle } from 'lucide-react'

export type TimelineEvent = {
  id: string
  date: string
  type: 'past' | 'future'
  category: 'credential' | 'privilege' | 'enrollment' | 'compliance' | 'milestone' | 'risk'
  title: string
  description?: string
  status?: 'completed' | 'pending' | 'overdue' | 'projected'
  metadata?: Record<string, any>
}

type FutureTimelineProps = {
  events: TimelineEvent[]
  currentDate?: string
  className?: string
  title?: string
  description?: string
}

const CATEGORY_COLORS: Record<TimelineEvent['category'], string> = {
  credential: 'bg-blue-100 text-blue-900 border-blue-300',
  privilege: 'bg-purple-100 text-purple-900 border-purple-300',
  enrollment: 'bg-green-100 text-green-900 border-green-300',
  compliance: 'bg-amber-100 text-amber-900 border-amber-300',
  milestone: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  risk: 'bg-rose-100 text-rose-900 border-rose-300',
}

const CATEGORY_ICONS: Record<TimelineEvent['category'], typeof Calendar> = {
  credential: Calendar,
  privilege: TrendingUp,
  enrollment: Clock,
  compliance: AlertCircle,
  milestone: Calendar,
  risk: AlertCircle,
}

const STATUS_COLORS: Record<NonNullable<TimelineEvent['status']>, string> = {
  completed: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  pending: 'bg-sky-50 text-sky-900 border-sky-200',
  overdue: 'bg-rose-50 text-rose-900 border-rose-200',
  projected: 'bg-slate-50 text-slate-900 border-slate-200',
}

export function FutureTimeline({
  events,
  currentDate,
  className,
  title = 'Lifecycle timeline',
  description = 'Past events and projected future milestones',
}: FutureTimelineProps) {
  const now = currentDate ? new Date(currentDate) : new Date()

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [events])

  const { pastEvents, futureEvents } = useMemo(() => {
    const past: TimelineEvent[] = []
    const future: TimelineEvent[] = []

    sortedEvents.forEach((event) => {
      const eventDate = new Date(event.date)
      if (eventDate < now) {
        past.push(event)
      } else {
        future.push(event)
      }
    })

    return { pastEvents: past, futureEvents: future }
  }, [sortedEvents, now])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const diffMs = date.getTime() - now.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      const daysAgo = Math.abs(diffDays)
      if (daysAgo === 0) return 'Today'
      if (daysAgo === 1) return 'Yesterday'
      if (daysAgo < 7) return `${daysAgo} days ago`
      if (daysAgo < 30) return `${Math.round(daysAgo / 7)} weeks ago`
      return `${Math.round(daysAgo / 30)} months ago`
    } else {
      if (diffDays === 0) return 'Today'
      if (diffDays === 1) return 'Tomorrow'
      if (diffDays < 7) return `In ${diffDays} days`
      if (diffDays < 30) return `In ${Math.round(diffDays / 7)} weeks`
      return `In ${Math.round(diffDays / 30)} months`
    }
  }

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-slate-200 via-slate-300 to-slate-200" aria-hidden="true">
            {/* Current time indicator */}
            <div className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-primary bg-background" aria-label="Current date" />
          </div>

          <div className="space-y-6">
            {/* Past events */}
            {pastEvents.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Past events</h3>
                {pastEvents.map((event, index) => {
                  const Icon = CATEGORY_ICONS[event.category]
                  const isLastPast = index === pastEvents.length - 1 && futureEvents.length > 0

                  return (
                    <div key={event.id} className="relative flex gap-4 pl-8">
                      <div className="absolute left-0 top-2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-background bg-slate-400" aria-hidden="true" />
                      <div className={cn('flex-1 rounded-lg border bg-background p-4', isLastPast && 'opacity-90')}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                              <Badge variant="outline" className={cn('text-xs', CATEGORY_COLORS[event.category])}>
                                {event.category}
                              </Badge>
                              {event.status && (
                                <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[event.status])}>
                                  {event.status}
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-semibold">{event.title}</h4>
                            {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" aria-hidden="true" />
                              <span>{formatDate(event.date)}</span>
                              <span>•</span>
                              <span>{getRelativeTime(event.date)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Forecast region divider */}
            {pastEvents.length > 0 && futureEvents.length > 0 && (
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-dashed border-primary/30" />
                </div>
                <div className="relative flex justify-center">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    Forecast region
                  </Badge>
                </div>
              </div>
            )}

            {/* Future events */}
            {futureEvents.length > 0 && (
              <div className="space-y-4">
                {pastEvents.length === 0 && <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Projected events</h3>}
                {futureEvents.map((event, index) => {
                  const Icon = CATEGORY_ICONS[event.category]
                  // Fade effect: more opacity for events further in the future
                  const daysFromNow = Math.round((new Date(event.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  const opacity = Math.max(0.6, 1 - daysFromNow / 365) // Fade over 1 year

                  return (
                    <div key={event.id} className="relative flex gap-4 pl-8" style={{ opacity }}>
                      <div className="absolute left-0 top-2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-background bg-primary/60" aria-hidden="true" />
                      <div className="flex-1 rounded-lg border border-dashed bg-muted/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                              <Badge variant="outline" className={cn('text-xs', CATEGORY_COLORS[event.category])}>
                                {event.category}
                              </Badge>
                              {event.status && (
                                <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[event.status])}>
                                  {event.status}
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-semibold">{event.title}</h4>
                            {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" aria-hidden="true" />
                              <span>{formatDate(event.date)}</span>
                              <span>•</span>
                              <span>{getRelativeTime(event.date)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {events.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">No timeline events available.</div>
            )}
          </div>
        </div>

        {/* Screen reader summary */}
        <dl className="sr-only">
          <dt>Timeline summary</dt>
          <dd>
            {pastEvents.length} past event{pastEvents.length !== 1 ? 's' : ''}, {futureEvents.length} projected future event
            {futureEvents.length !== 1 ? 's' : ''}.
          </dd>
        </dl>
      </CardContent>
    </Card>
  )
}

