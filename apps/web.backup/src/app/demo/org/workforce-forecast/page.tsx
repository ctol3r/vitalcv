'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ForecastAlerts, type ForecastAlert } from '@/components/forecast/ForecastAlerts'
import { CredentialBottleneck, type CredentialBottleneck as CredentialBottleneckType } from '@/components/forecast/CredentialBottleneck'
import { cn } from '@/lib/utils'
import { ArrowUpRight, BarChart3, Calendar, TrendingDown, TrendingUp, UsersRound } from 'lucide-react'

interface DemandSupplyData {
  date: string
  demand: number
  supply: number
  shortage: number
  department: string
}

interface DepartmentHeatmap {
  department: string
  role: string
  week: number
  coverage: number
  shortage: number
  risk: 'low' | 'medium' | 'high' | 'critical'
}

const DEMAND_SUPPLY_CURVE: DemandSupplyData[] = [
  { date: '2025-11-10', demand: 45, supply: 48, shortage: -3, department: 'ICU' },
  { date: '2025-11-17', demand: 47, supply: 46, shortage: 1, department: 'ICU' },
  { date: '2025-11-24', demand: 52, supply: 45, shortage: 7, department: 'ICU' },
  { date: '2025-12-01', demand: 55, supply: 44, shortage: 11, department: 'ICU' },
  { date: '2025-12-08', demand: 58, supply: 43, shortage: 15, department: 'ICU' },
  { date: '2025-12-15', demand: 60, supply: 42, shortage: 18, department: 'ICU' },
  { date: '2025-12-22', demand: 62, supply: 41, shortage: 21, department: 'ICU' },
]

const DEPARTMENT_HEATMAP: DepartmentHeatmap[] = [
  { department: 'ICU', role: 'Intensivist', week: 48, coverage: 0.85, shortage: 3, risk: 'high' },
  { department: 'ICU', role: 'APP', week: 48, coverage: 0.92, shortage: 1, risk: 'low' },
  { department: 'ICU', role: 'RN', week: 48, coverage: 0.78, shortage: 5, risk: 'medium' },
  { department: 'ED', role: 'Emergency MD', week: 48, coverage: 0.95, shortage: 0, risk: 'low' },
  { department: 'ED', role: 'Fast-track APP', week: 48, coverage: 0.88, shortage: 2, risk: 'low' },
  { department: 'Cath Lab', role: 'Interventional Card', week: 48, coverage: 0.72, shortage: 4, risk: 'high' },
  { department: 'Cath Lab', role: 'RN', week: 48, coverage: 0.90, shortage: 1, risk: 'low' },
  { department: 'Telehealth', role: 'Behavioral Health', week: 48, coverage: 0.65, shortage: 8, risk: 'critical' },
  { department: 'Med/Surg', role: 'Hospitalist', week: 48, coverage: 0.82, shortage: 3, risk: 'medium' },
  { department: 'Med/Surg', role: 'RN', week: 48, coverage: 0.88, shortage: 2, risk: 'low' },
]

const FORECAST_ALERTS: ForecastAlert[] = [
  {
    id: 'alert-1',
    type: 'critical_demand',
    severity: 'critical',
    title: 'ICU Intensivist shortage predicted',
    description: 'Forecast shows 21 FTE shortage by week 52. Multiple privilege renewals and DEA expirations converging.',
    department: 'ICU',
    role: 'Intensivist',
    affectedCount: 12,
    impactDate: '2025-12-22',
    timestamp: new Date().toISOString(),
    actionable: true,
  },
  {
    id: 'alert-2',
    type: 'supply_drop',
    severity: 'high',
    title: 'Telehealth behavioral health coverage drop',
    description: 'Supply expected to drop 15% in next 30 days due to license renewal cycle.',
    department: 'Telehealth',
    role: 'Behavioral Health',
    affectedCount: 8,
    impactDate: '2025-12-01',
    timestamp: new Date().toISOString(),
    actionable: true,
  },
  {
    id: 'alert-3',
    type: 'privilege_renewal',
    severity: 'medium',
    title: 'Cath Lab privileges renewal window',
    description: '15 interventional cardiologists have privilege renewals due in next 60 days.',
    department: 'Cath Lab',
    role: 'Interventional Card',
    affectedCount: 15,
    impactDate: '2026-01-15',
    timestamp: new Date().toISOString(),
    actionable: true,
  },
]

const CREDENTIAL_BOTTLENECKS: CredentialBottleneckType[] = [
  {
    id: 'bottleneck-1',
    type: 'license_renewal',
    credentialName: 'State Medical License',
    affectedCount: 24,
    peakDate: '2025-12-15',
    severity: 'high',
    department: 'ICU',
    renewalWindow: {
      start: '2025-12-01',
      end: '2025-12-31',
    },
    estimatedImpact: {
      coverageDrop: 12,
      affectedShifts: 48,
    },
  },
  {
    id: 'bottleneck-2',
    type: 'dea_expiration',
    credentialName: 'DEA Registration',
    affectedCount: 18,
    peakDate: '2025-12-20',
    severity: 'critical',
    department: 'ED',
    renewalWindow: {
      start: '2025-12-10',
      end: '2025-12-30',
    },
    estimatedImpact: {
      coverageDrop: 8,
      affectedShifts: 72,
    },
    overlapWith: ['bottleneck-1'],
  },
  {
    id: 'bottleneck-3',
    type: 'board_cycle',
    credentialName: 'Board Certification Renewal',
    affectedCount: 12,
    peakDate: '2026-01-10',
    severity: 'medium',
    department: 'Cath Lab',
    renewalWindow: {
      start: '2025-12-20',
      end: '2026-01-20',
    },
    estimatedImpact: {
      coverageDrop: 6,
      affectedShifts: 24,
    },
  },
]

const RISK_COLORS: Record<DepartmentHeatmap['risk'], string> = {
  low: 'bg-emerald-100 border-emerald-200 text-emerald-900',
  medium: 'bg-amber-100 border-amber-200 text-amber-900',
  high: 'bg-orange-100 border-orange-200 text-orange-900',
  critical: 'bg-rose-100 border-rose-200 text-rose-900',
}

export default function OrgWorkforceForecastPage() {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')
  const [selectedHorizon, setSelectedHorizon] = useState<'30d' | '60d' | '90d'>('90d')

  const departments = useMemo(() => {
    const depts = new Set(DEPARTMENT_HEATMAP.map((h) => h.department))
    return Array.from(depts)
  }, [])

  const filteredHeatmap = useMemo(() => {
    if (selectedDepartment === 'all') return DEPARTMENT_HEATMAP
    return DEPARTMENT_HEATMAP.filter((h) => h.department === selectedDepartment)
  }, [selectedDepartment])

  const maxShortage = Math.max(...DEMAND_SUPPLY_CURVE.map((d) => d.shortage))
  const minShortage = Math.min(...DEMAND_SUPPLY_CURVE.map((d) => d.shortage))
  const range = maxShortage - minShortage || 1

  const SVG_WIDTH = 600
  const SVG_HEIGHT = 300
  const SVG_PADDING = 40

  const chartPath = useMemo(() => {
    const width = SVG_WIDTH - SVG_PADDING * 2
    const height = SVG_HEIGHT - SVG_PADDING * 2
    const points = DEMAND_SUPPLY_CURVE.map((point, index) => {
      const x = SVG_PADDING + (width * index) / Math.max(DEMAND_SUPPLY_CURVE.length - 1, 1)
      const yDemand = SVG_PADDING + height * (1 - (point.demand - minShortage) / range)
      const ySupply = SVG_PADDING + height * (1 - (point.supply - minShortage) / range)
      return { x, yDemand, ySupply, point }
    })
    return points
  }, [range, minShortage])

  const totalShortage = DEMAND_SUPPLY_CURVE.reduce((sum, d) => sum + Math.max(0, d.shortage), 0)
  const avgCoverage = filteredHeatmap.reduce((sum, h) => sum + h.coverage, 0) / filteredHeatmap.length || 0

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Demo » Org » Workforce Forecast</p>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <UsersRound className="h-6 w-6" /> Org Workforce Forecast Dashboard
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          Shows demand vs supply curves, predicted shortages, and heatmaps per department. SR-friendly visualization
          with comprehensive forecast analytics.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Coverage</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{Math.round(avgCoverage * 100)}%</div>
            <p className="text-xs text-muted-foreground">Across all departments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Predicted Shortages</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-600">{totalShortage}</div>
            <p className="text-xs text-muted-foreground">FTE gap over forecast period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {FORECAST_ALERTS.filter((a) => a.severity === 'critical').length}
            </div>
            <p className="text-xs text-muted-foreground">Require immediate action</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bottlenecks</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{CREDENTIAL_BOTTLENECKS.length}</div>
            <p className="text-xs text-muted-foreground">Credential renewal events</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Demand vs Supply Curve</CardTitle>
            <CardDescription>Forecasted demand and supply over the next 12 weeks</CardDescription>
            <div className="flex gap-2 mt-2">
              {(['30d', '60d', '90d'] as const).map((horizon) => (
                <Button
                  key={horizon}
                  variant={selectedHorizon === horizon ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedHorizon(horizon)}
                  className="text-xs"
                >
                  {horizon}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <svg width={SVG_WIDTH} height={SVG_HEIGHT} className="w-full" viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}>
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map((value) => {
                  const y = SVG_PADDING + ((SVG_HEIGHT - SVG_PADDING * 2) * (100 - value)) / 100
                  return (
                    <line
                      key={value}
                      x1={SVG_PADDING}
                      x2={SVG_WIDTH - SVG_PADDING}
                      y1={y}
                      y2={y}
                      stroke="hsl(var(--border))"
                      strokeDasharray="2 4"
                      strokeWidth="1"
                      opacity={0.3}
                      aria-hidden="true"
                    />
                  )
                })}

                {/* Demand line */}
                <polyline
                  fill="none"
                  stroke="hsl(0, 84%, 60%)"
                  strokeWidth="2.5"
                  points={chartPath.map((p) => `${p.x},${p.yDemand}`).join(' ')}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {chartPath.map((p, idx) => (
                  <circle key={`demand-${idx}`} cx={p.x} cy={p.yDemand} r="4" fill="hsl(0, 84%, 60%)" />
                ))}

                {/* Supply line */}
                <polyline
                  fill="none"
                  stroke="hsl(142, 76%, 36%)"
                  strokeWidth="2.5"
                  points={chartPath.map((p) => `${p.x},${p.ySupply}`).join(' ')}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {chartPath.map((p, idx) => (
                  <circle key={`supply-${idx}`} cx={p.x} cy={p.ySupply} r="4" fill="hsl(142, 76%, 36%)" />
                ))}

                {/* Labels */}
                <text x={SVG_PADDING} y={SVG_PADDING - 10} className="text-xs fill-muted-foreground">
                  Demand
                </text>
                <text x={SVG_PADDING} y={SVG_PADDING + 20} className="text-xs fill-muted-foreground">
                  Supply
                </text>
              </svg>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-rose-500" />
                  <span>Demand</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <span>Supply</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <ForecastAlerts alerts={FORECAST_ALERTS} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Department Coverage Heatmap</CardTitle>
          <CardDescription>Coverage and shortage risk by department and role</CardDescription>
          <div className="flex gap-2 mt-2">
            <Button
              variant={selectedDepartment === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedDepartment('all')}
              className="text-xs"
            >
              All Departments
            </Button>
            {departments.map((dept) => (
              <Button
                key={dept}
                variant={selectedDepartment === dept ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedDepartment(dept)}
                className="text-xs"
              >
                {dept}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredHeatmap.map((cell) => (
              <div
                key={`${cell.department}-${cell.role}`}
                className={cn('rounded-lg border px-4 py-3 shadow-sm transition hover:shadow-md', RISK_COLORS[cell.risk])}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold">{cell.department}</p>
                    <p className="text-xs text-muted-foreground">{cell.role}</p>
                  </div>
                  <Badge variant="outline" className={cn('text-xs', RISK_COLORS[cell.risk])}>
                    {Math.round(cell.coverage * 100)}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Week {cell.week}</span>
                  {cell.shortage > 0 && (
                    <span className="font-semibold text-rose-600">-{cell.shortage} FTE</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <CredentialBottleneck bottlenecks={CREDENTIAL_BOTTLENECKS} />
    </div>
  )
}

