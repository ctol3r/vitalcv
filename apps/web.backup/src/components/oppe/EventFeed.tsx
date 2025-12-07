import { useMemo, useState } from 'react'
import { BadgeAlert, BadgeHelp, Filter, FlagTriangleRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export type ProcedureEventSeverity = 'info' | 'warning' | 'critical'

export type ProcedureEvent = {
  id: string
  clinician: string
  privilegeCode: string
  procedure: string
  timestamp: string
  severity: ProcedureEventSeverity
  summary: string
  detail?: string
  scoreImpact?: number
  recommendedAction?: string
}

type SeverityFilterOption = 'all' | ProcedureEventSeverity

type EventFeedProps = {
  events: ProcedureEvent[]
  className?: string
  defaultFilter?: SeverityFilterOption
  title?: string
  description?: string
}

const severityConfig: Record<
  ProcedureEventSeverity,
  {
    label: string
    badgeVariant: 'secondary' | 'default' | 'destructive'
    icon: typeof AlertCircle
    srTone: string
  }
> = {
  info: { label: 'Info', badgeVariant: 'secondary', icon: BadgeHelp, srTone: 'informational' },
  warning: { label: 'Warning', badgeVariant: 'default', icon: BadgeAlert, srTone: 'warning' },
  critical: { label: 'Critical', badgeVariant: 'destructive', icon: FlagTriangleRight, srTone: 'critical' },
}

export function EventFeed({ events, className, defaultFilter = 'all', title = 'Procedure events', description }: EventFeedProps) {
  const [selectedEvent, setSelectedEvent] = useState<ProcedureEvent | null>(null)
  const [filter, setFilter] = useState<SeverityFilterOption>(defaultFilter)

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events
    return events.filter((event) => event.severity === filter)
  }, [events, filter])

  const handleOpen = (event: ProcedureEvent) => setSelectedEvent(event)
  const handleClose = () => setSelectedEvent(null)

  return (
    <>
      <Card className={cn('h-full', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {title}
          </CardTitle>
          <CardDescription>
            {description || 'Recent OPPE-triggered procedure events. Select a severity filter to focus on the riskiest cases.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Filter events by severity">
            {(['all', 'info', 'warning', 'critical'] as const).map((option) => (
              <Button
                key={option}
                size="sm"
                variant={filter === option ? 'default' : 'outline'}
                onClick={() => setFilter(option)}
                className="capitalize"
                aria-pressed={filter === option}
              >
                {option === 'all' ? 'All' : severityConfig[option].label}
              </Button>
            ))}
          </div>

          <div className="divide-y rounded-md border" role="list">
            {filteredEvents.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No procedure events match the selected filters.</p>
            ) : (
              filteredEvents.map((event) => {
                const config = severityConfig[event.severity]
                return (
                  <button
                    key={event.id}
                    type="button"
                    className="w-full text-left p-4 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/80 transition-colors hover:bg-muted/40"
                    onClick={() => handleOpen(event)}
                    aria-label={`Inspect ${config.srTone} event for ${event.clinician}: ${event.summary}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <config.icon className="h-4 w-4" aria-hidden="true" />
                          <Badge variant={config.badgeVariant}>{config.label}</Badge>
                          <span aria-hidden="true">•</span>
                          <span>{new Date(event.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="font-medium">{event.summary}</p>
                        <p className="text-sm text-muted-foreground">
                          {event.clinician} · {event.procedure} ({event.privilegeCode})
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground">View</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedEvent)} onOpenChange={(open) => !open && handleClose()}>
        {selectedEvent && (
          <DialogContent className="sm:max-w-xl sm:left-auto sm:right-0 sm:top-0 sm:h-dvh sm:translate-x-0 sm:translate-y-0 sm:rounded-none sm:border-l">
            <DialogHeader>
              <DialogTitle>{selectedEvent.summary}</DialogTitle>
              <DialogDescription>
                Logged {new Date(selectedEvent.timestamp).toLocaleString()} · {selectedEvent.clinician} · {selectedEvent.procedure}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <section className="space-y-1">
                <h3 className="text-sm font-semibold text-muted-foreground">Event details</h3>
                <p className="text-sm leading-relaxed">{selectedEvent.detail || 'No extra narrative provided for this event.'}</p>
              </section>
              <section className="space-y-2">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Privilege code</dt>
                    <dd className="font-medium">{selectedEvent.privilegeCode}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Severity</dt>
                    <dd>
                      <Badge variant={severityConfig[selectedEvent.severity].badgeVariant}>
                        {severityConfig[selectedEvent.severity].label}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Score impact</dt>
                    <dd className="font-medium">
                      {selectedEvent.scoreImpact !== undefined ? `${selectedEvent.scoreImpact > 0 ? '+' : ''}${selectedEvent.scoreImpact} pts` : 'N/A'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Recommended action</dt>
                    <dd className="font-medium">{selectedEvent.recommendedAction || 'Review case details'}</dd>
                  </div>
                </dl>
              </section>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}

