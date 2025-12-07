'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { AlertTriangle, Calendar, FileWarning, ShieldAlert, TrendingUp } from 'lucide-react'

export type CredentialBottleneck = {
  id: string
  type: 'license_renewal' | 'dea_expiration' | 'board_cycle' | 'compact_expiration'
  credentialName: string
  affectedCount: number
  peakDate: string
  severity: 'critical' | 'high' | 'medium'
  overlapWith?: string[] // IDs of other bottlenecks that overlap
  department?: string
  region?: string
  renewalWindow: {
    start: string
    end: string
  }
  estimatedImpact: {
    coverageDrop: number
    affectedShifts: number
  }
}

type CredentialBottleneckProps = {
  bottlenecks: CredentialBottleneck[]
  className?: string
  title?: string
  description?: string
  onBottleneckClick?: (bottleneck: CredentialBottleneck) => void
  selectedTimeframe?: '30d' | '60d' | '90d' | '180d'
  onTimeframeChange?: (timeframe: '30d' | '60d' | '90d' | '180d') => void
}

const TYPE_COLORS: Record<CredentialBottleneck['type'], string> = {
  license_renewal: 'bg-blue-50 text-blue-900 border-blue-200',
  dea_expiration: 'bg-rose-50 text-rose-900 border-rose-200',
  board_cycle: 'bg-purple-50 text-purple-900 border-purple-200',
  compact_expiration: 'bg-amber-50 text-amber-900 border-amber-200',
}

const TYPE_ICONS: Record<CredentialBottleneck['type'], typeof Calendar> = {
  license_renewal: Calendar,
  dea_expiration: FileWarning,
  board_cycle: ShieldAlert,
  compact_expiration: TrendingUp,
}

const TYPE_LABELS: Record<CredentialBottleneck['type'], string> = {
  license_renewal: 'License Renewal',
  dea_expiration: 'DEA Expiration',
  board_cycle: 'Board Cycle',
  compact_expiration: 'Compact Expiration',
}

const SEVERITY_COLORS: Record<CredentialBottleneck['severity'], string> = {
  critical: 'bg-rose-100 text-rose-900 border-rose-200',
  high: 'bg-amber-100 text-amber-900 border-amber-200',
  medium: 'bg-sky-100 text-sky-900 border-sky-200',
}

const TIMEFRAME_DAYS: Record<'30d' | '60d' | '90d' | '180d', number> = {
  '30d': 30,
  '60d': 60,
  '90d': 90,
  '180d': 180,
}

export function CredentialBottleneck({
  bottlenecks,
  className,
  title = 'Credential bottleneck analyzer',
  description = 'Shows future bottlenecks: mass license renewals, upcoming DEA expirations, overlapping board cycles',
  onBottleneckClick,
  selectedTimeframe = '90d',
  onTimeframeChange,
}: CredentialBottleneckProps) {
  const [selectedType, setSelectedType] = useState<CredentialBottleneck['type'] | 'all'>('all')

  const filteredBottlenecks = useMemo(() => {
    const now = new Date()
    const cutoffDate = new Date(now.getTime() + TIMEFRAME_DAYS[selectedTimeframe] * 24 * 60 * 60 * 1000)

    return bottlenecks
      .filter((b) => {
        const peakDate = new Date(b.peakDate)
        if (peakDate > cutoffDate) return false
        if (selectedType !== 'all' && b.type !== selectedType) return false
        return true
      })
      .sort((a, b) => {
        const dateA = new Date(a.peakDate).getTime()
        const dateB = new Date(b.peakDate).getTime()
        return dateA - dateB
      })
  }, [bottlenecks, selectedTimeframe, selectedType])

  const groupedByType = useMemo(() => {
    const groups: Record<string, CredentialBottleneck[]> = {}
    filteredBottlenecks.forEach((b) => {
      if (!groups[b.type]) groups[b.type] = []
      groups[b.type].push(b)
    })
    return groups
  }, [filteredBottlenecks])

  const criticalCount = filteredBottlenecks.filter((b) => b.severity === 'critical').length
  const totalAffected = filteredBottlenecks.reduce((sum, b) => sum + b.affectedCount, 0)

  if (filteredBottlenecks.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No bottlenecks detected in the selected timeframe.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        <div className="flex flex-wrap items-center gap-4 mt-4">
          {onTimeframeChange && (
            <div className="flex gap-2">
              {(['30d', '60d', '90d', '180d'] as const).map((tf) => (
                <Button
                  key={tf}
                  variant={selectedTimeframe === tf ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onTimeframeChange(tf)}
                  className="text-xs"
                >
                  {tf}
                </Button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedType('all')}
              className="text-xs"
            >
              All Types
            </Button>
            {(Object.keys(TYPE_LABELS) as CredentialBottleneck['type'][]).map((type) => (
              <Button
                key={type}
                variant={selectedType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType(type)}
                className="text-xs"
              >
                {TYPE_LABELS[type]}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm mt-2">
          <div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Total Bottlenecks</span>
            <p className="font-semibold text-lg">{filteredBottlenecks.length}</p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Critical</span>
            <p className="font-semibold text-lg text-rose-600">{criticalCount}</p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Affected Clinicians</span>
            <p className="font-semibold text-lg">{totalAffected}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(groupedByType).map(([type, items]) => {
          const TypeIcon = TYPE_ICONS[type as CredentialBottleneck['type']]
          return (
            <div key={type} className="space-y-3">
              <div className="flex items-center gap-2">
                <TypeIcon className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">{TYPE_LABELS[type as CredentialBottleneck['type']]}</h3>
                <Badge variant="outline" className="text-xs">
                  {items.length} {items.length === 1 ? 'bottleneck' : 'bottlenecks'}
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Credential</TableHead>
                    <TableHead>Peak Date</TableHead>
                    <TableHead>Affected</TableHead>
                    <TableHead>Coverage Impact</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((bottleneck) => (
                    <TableRow key={bottleneck.id}>
                      <TableCell className="font-medium">
                        <div>
                          <p>{bottleneck.credentialName}</p>
                          {bottleneck.department && (
                            <p className="text-xs text-muted-foreground">{bottleneck.department}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{formatDate(bottleneck.peakDate)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatRelativeDate(bottleneck.peakDate)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold">{bottleneck.affectedCount}</p>
                        <p className="text-xs text-muted-foreground">clinicians</p>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-rose-600">
                            -{bottleneck.estimatedImpact.coverageDrop}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {bottleneck.estimatedImpact.affectedShifts} shifts
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-xs', SEVERITY_COLORS[bottleneck.severity])}>
                          {bottleneck.severity}
                        </Badge>
                        {bottleneck.overlapWith && bottleneck.overlapWith.length > 0 && (
                          <p className="text-xs text-amber-600 mt-1">
                            Overlaps with {bottleneck.overlapWith.length} other{'\n'}
                            {bottleneck.overlapWith.length === 1 ? 'bottleneck' : 'bottlenecks'}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {onBottleneckClick && (
                          <Button variant="outline" size="sm" onClick={() => onBottleneckClick(bottleneck)}>
                            View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function formatDate(input: string) {
  const date = new Date(input)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRelativeDate(input: string) {
  const date = new Date(input)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays < 7) return `In ${diffDays} days`
  if (diffDays < 30) return `In ${Math.round(diffDays / 7)} weeks`
  return `In ${Math.round(diffDays / 30)} months`
}

