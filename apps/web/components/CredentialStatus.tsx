'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export type CredentialStatusState = 'valid' | 'expiring' | 'expired' | 'review'

export type CredentialStatusItem = {
  id: string
  label: string
  status: CredentialStatusState
  issuer?: string
  lastVerified?: string
  expiresAt?: string
  note?: string
}

type CredentialStatusProps = {
  title: string
  description: string
  items: CredentialStatusItem[]
}

const STATUS_LABELS: Record<CredentialStatusState, string> = {
  valid: 'VALID',
  expiring: 'EXPIRING',
  expired: 'EXPIRED',
  review: 'REVIEW',
}

const STATUS_TONES: Record<CredentialStatusState, string> = {
  valid: 'border-emerald-200/70 bg-emerald-500/10 text-emerald-700',
  expiring: 'border-amber-200/70 bg-amber-500/10 text-amber-700',
  expired: 'border-red-200/70 bg-red-500/10 text-red-700',
  review: 'border-slate-200/70 bg-slate-500/10 text-slate-700',
}

const formatDate = (value?: string) => {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

export function CredentialStatus({ title, description, items }: CredentialStatusProps) {
  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Badge variant="outline" className="rounded-full border-border/70 px-3 py-1 text-xs">
          Read-only
        </Badge>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[320px] pr-3">
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border/60 bg-background/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{item.label}</div>
                    {item.issuer && (
                      <div className="text-xs text-muted-foreground">{item.issuer}</div>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={cn('rounded-full border px-2.5 py-1 text-xs', STATUS_TONES[item.status])}
                  >
                    {STATUS_LABELS[item.status]}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <div>
                    <span className="uppercase tracking-[0.2em]">Verified</span>
                    <div className="text-foreground">{formatDate(item.lastVerified)}</div>
                  </div>
                  <div>
                    <span className="uppercase tracking-[0.2em]">Expires</span>
                    <div className="text-foreground">{formatDate(item.expiresAt)}</div>
                  </div>
                </div>
                {item.note && <p className="mt-3 text-xs text-muted-foreground">{item.note}</p>}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
