import { AlertTriangle, Ban, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type DeaStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED'
type DeaSchedule = 'II' | 'III' | 'IV' | 'V'

export interface DEAChipProps {
  status: DeaStatus
  schedules: DeaSchedule[]
  mateTrainingComplete?: boolean
  className?: string
}

const statusCopy: Record<DeaStatus, string> = {
  ACTIVE: 'DEA Active',
  EXPIRED: 'DEA Expired',
  SUSPENDED: 'DEA Suspended',
}

const variantMap: Record<'ok' | 'warning' | 'danger', React.ComponentProps<typeof Badge>['variant']> =
  {
    ok: 'secondary',
    warning: 'outline',
    danger: 'destructive',
  }

const iconMap = {
  ok: ShieldCheck,
  warning: AlertTriangle,
  danger: Ban,
}

export function DEAChip({
  status,
  schedules,
  mateTrainingComplete = true,
  className,
}: DEAChipProps) {
  const showMateAlert = !mateTrainingComplete
  const tone = showMateAlert
    ? 'danger'
    : status === 'ACTIVE'
      ? 'ok'
      : status === 'SUSPENDED'
        ? 'warning'
        : 'danger'
  const Icon = iconMap[tone]

  const label = showMateAlert ? 'Missing MATE' : statusCopy[status]
  const srDescription = [
    label,
    `Schedules: ${schedules?.length ? schedules.join(', ') : 'None'}`,
    showMateAlert ? 'MATE Act training incomplete' : 'MATE Act training complete',
  ].join('. ')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={variantMap[tone]}
          className={cn(
            'gap-1.5 px-2.5 py-1 text-[13px] font-medium',
            {
              'aria-[invalid=true]:ring-destructive/40': showMateAlert,
            },
            className,
          )}
          aria-label={label}
          aria-invalid={showMateAlert}
        >
          <Icon className="size-3.5" aria-hidden />
          <span>{label}</span>
          <span className="sr-only">{srDescription}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent sideOffset={8} side="top" className="max-w-xs text-left">
        <p className="text-sm font-semibold">DEA Status Detail</p>
        <dl className="mt-1.5 space-y-1 text-xs text-primary-foreground/80">
          <div className="flex items-start justify-between gap-4">
            <dt>Status</dt>
            <dd className="font-medium text-primary-foreground">{label}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt>Schedules</dt>
            <dd className="font-mono text-[11px] uppercase tracking-wide">
              {schedules?.length ? schedules.join(' · ') : 'Not authorized'}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt>MATE training</dt>
            <dd className="font-medium text-primary-foreground">
              {mateTrainingComplete ? 'Complete' : 'Missing'}
            </dd>
          </div>
        </dl>
      </TooltipContent>
    </Tooltip>
  )
}

export default DEAChip

