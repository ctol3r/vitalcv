'use client'

import { useMemo, useState } from 'react'
import { AlertOctagon, AlertTriangle, BadgeCheck, Clock3 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export type CredentialSyncSource = {
  id: string
  label: string
  lastUpdated: string
  thresholdHours?: number
  description?: string
}

type CredentialSyncBadgeProps = {
  sources: CredentialSyncSource[]
  defaultThresholdHours?: number
}

type SyncStatus = 'synced' | 'warning' | 'critical'

const statusConfig: Record<
  SyncStatus,
  {
    label: string
    tone: string
    icon: typeof BadgeCheck
  }
> = {
  synced: {
    label: 'Synced',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: BadgeCheck,
  },
  warning: {
    label: 'Refresh suggested',
    tone: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: AlertTriangle,
  },
  critical: {
    label: 'Out of date',
    tone: 'border-rose-200 bg-rose-50 text-rose-900',
    icon: AlertOctagon,
  },
}

export function CredentialSyncBadge({ sources, defaultThresholdHours = 48 }: CredentialSyncBadgeProps) {
  const [open, setOpen] = useState(false)

  const enrichedSources = useMemo(() => {
    const now = Date.now()
    return sources.map((source) => {
      const threshold = source.thresholdHours ?? defaultThresholdHours
      const updatedAt = new Date(source.lastUpdated)
      const ageMs = now - updatedAt.getTime()
      const ageHours = ageMs / (1000 * 60 * 60)
      let freshness: SyncStatus = 'synced'
      if (ageHours > threshold * 2) {
        freshness = 'critical'
      } else if (ageHours > threshold) {
        freshness = 'warning'
      }
      return {
        ...source,
        ageHours,
        freshness,
        threshold,
      }
    })
  }, [sources, defaultThresholdHours])

  const status = useMemo<SyncStatus>(() => {
    if (enrichedSources.some((entry) => entry.freshness === 'critical')) {
      return 'critical'
    }
    if (enrichedSources.some((entry) => entry.freshness === 'warning')) {
      return 'warning'
    }
    return 'synced'
  }, [enrichedSources])

  const config = statusConfig[status]

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors hover:opacity-90',
          config.tone
        )}
        aria-pressed={open}
      >
        <config.icon className="h-4 w-4" aria-hidden="true" />
        {config.label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Credential sync health</DialogTitle>
            <DialogDescription>
              Each source shows the most recent PSV pull timestamp compared to its freshness threshold.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {enrichedSources.map((source) => (
              <div key={source.id} className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{source.label}</p>
                    {source.description && (
                      <p className="text-xs text-muted-foreground">{source.description}</p>
                    )}
                  </div>
                  <Badge
                    variant={
                      source.freshness === 'critical'
                        ? 'destructive'
                        : source.freshness === 'warning'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {statusConfig[source.freshness].label}
                  </Badge>
                </div>
                <dl className="mt-3 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4" aria-hidden="true" />
                    <div>
                      <dt className="uppercase tracking-wide">Last updated</dt>
                      <dd className="text-sm text-foreground">
                        {formatRelative(source.lastUpdated)} ({source.threshold}h target)
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                    <div>
                      <dt className="uppercase tracking-wide">Threshold</dt>
                      <dd className="text-sm text-foreground">Refresh every {source.threshold}h</dd>
                    </div>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function formatRelative(timestamp: string): string {
  const target = new Date(timestamp).getTime()
  if (Number.isNaN(target)) {
    return 'Unknown'
  }
  const deltaMs = Date.now() - target
  const hours = Math.floor(deltaMs / (1000 * 60 * 60))
  if (hours < 1) {
    const minutes = Math.max(1, Math.floor(deltaMs / (1000 * 60)))
    return `${minutes}m ago`
  }
  if (hours < 48) {
    return `${hours}h ago`
  }
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}


