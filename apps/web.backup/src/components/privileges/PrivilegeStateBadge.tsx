'use client'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { AlertTriangle, Ban, CheckCircle2, PauseCircle } from 'lucide-react'

export type PrivilegeState = 'FULL' | 'RESTRICTED' | 'HOLD' | 'SUSPENDED'

type PrivilegeStateConfig = {
  label: string
  icon: React.ComponentType<{ className?: string }>
  badgeClassName: string
  tone: 'neutral' | 'warning' | 'critical'
  description: string
}

const STATE_CONFIG: Record<PrivilegeState, PrivilegeStateConfig> = {
  FULL: {
    label: 'Full access',
    icon: CheckCircle2,
    badgeClassName: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    tone: 'neutral',
    description: 'Privilege is active with no risk overrides',
  },
  RESTRICTED: {
    label: 'Restricted',
    icon: AlertTriangle,
    badgeClassName: 'bg-amber-50 text-amber-900 border-amber-200',
    tone: 'warning',
    description: 'Privilege is limited to reduced scope or coverage',
  },
  HOLD: {
    label: 'Hold',
    icon: PauseCircle,
    badgeClassName: 'bg-slate-100 text-slate-900 border-slate-200',
    tone: 'warning',
    description: 'Privilege temporarily paused pending review',
  },
  SUSPENDED: {
    label: 'Suspended',
    icon: Ban,
    badgeClassName: 'bg-rose-50 text-rose-900 border-rose-200',
    tone: 'critical',
    description: 'Privilege revoked until committee reinstates it',
  },
}

export type PrivilegeStateBadgeProps = {
  state: PrivilegeState
  reason?: string
  updatedAt?: string
  className?: string
}

export function PrivilegeStateBadge({ state, reason, updatedAt, className }: PrivilegeStateBadgeProps) {
  const config = STATE_CONFIG[state]
  const Icon = config.icon
  const tooltipMessage = buildTooltipMessage(config.description, reason, updatedAt)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn('gap-1.5 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide', config.badgeClassName, className)}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{state}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent sideOffset={8} className="max-w-xs text-left">
        <p className="font-semibold">{config.label}</p>
        <p className="text-xs opacity-90">{tooltipMessage}</p>
      </TooltipContent>
    </Tooltip>
  )
}

function buildTooltipMessage(description: string, reason?: string, updatedAt?: string) {
  const segments: string[] = [description]

  if (reason) {
    segments.push(reason)
  }
  if (updatedAt) {
    const formatted = new Date(updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    segments.push(`Updated ${formatted}`)
  }

  return segments.join(' • ')
}


