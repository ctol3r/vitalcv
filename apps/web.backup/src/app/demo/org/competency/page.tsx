'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, BarChart3, Filter, TrendingDown, TrendingUp, Users2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FusionTrendChart, type FusionTrendDatum } from '@/components/fusion/FusionTrendChart'
import { TrendChart } from '@/components/oppe/TrendChart'
import { cn } from '@/lib/utils'

type CompetencyDomain = 'Clinical Skills' | 'Patient Safety' | 'Communication' | 'Professionalism' | 'Quality Metrics'

type CompetencyRow = {
  id: string
  name: string
  department: string
  specialty: string
  cci: number
  cciTrend: 'up' | 'down' | 'stable'
  fusionScore: number
  domains: Record<CompetencyDomain, { score: number; risk: 'low' | 'medium' | 'high' }>
  strengths: CompetencyDomain[]
  risks: Array<{ domain: CompetencyDomain; severity: 'medium' | 'high'; description: string }>
  lastUpdated: string
}

type OrgCompetencyData = {
  summary: {
    avgCci: number
    cciTrend: number
    totalClinicians: number
    atRisk: number
    highPerformers: number
  }
  trend: FusionTrendDatum[]
  clinicians: CompetencyRow[]
}

export default function OrgCompetencyDashboardPage() {
  const dataset = useMemo(() => buildMockData(), [])
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'cci' | 'fusionScore' | 'name'>('cci')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [srMessage, setSrMessage] = useState('')

  const departments = useMemo(() => {
    return ['all', ...new Set(dataset.clinicians.map((row) => row.department))]
  }, [dataset])

  const filteredAndSorted = useMemo(() => {
    let filtered = dataset.clinicians.filter((row) => {
      const matchesSearch =
        !search ||
        row.name.toLowerCase().includes(search.toLowerCase()) ||
        row.specialty.toLowerCase().includes(search.toLowerCase()) ||
        row.department.toLowerCase().includes(search.toLowerCase())
      const matchesDepartment = departmentFilter === 'all' || row.department === departmentFilter
      return matchesSearch && matchesDepartment
    })

    filtered.sort((a, b) => {
      let aVal: number | string
      let bVal: number | string

      switch (sortBy) {
        case 'cci':
          aVal = a.cci
          bVal = b.cci
          break
        case 'fusionScore':
          aVal = a.fusionScore
          bVal = b.fusionScore
          break
        case 'name':
          aVal = a.name
          bVal = b.name
          break
        default:
          return 0
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      return sortDirection === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal))
    })

    return filtered
  }, [dataset.clinicians, search, departmentFilter, sortBy, sortDirection])

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDirection('desc')
    }
    setSrMessage(`Sorted by ${column} ${sortBy === column && sortDirection === 'desc' ? 'descending' : 'ascending'}`)
    setTimeout(() => setSrMessage(''), 2000)
  }

  const cciTrendData = useMemo(
    () =>
      dataset.trend.map((point) => ({
        label: point.label,
        value: point.combined,
        date: point.date,
      })),
    [dataset.trend],
  )

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Org • Competency</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary" aria-hidden="true" />
              Org Competency Dashboard
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Comprehensive view of Clinical Competency Index (CCI) across the organization. Track trends, identify risks, and highlight strengths by department.
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Avg CCI"
          value={dataset.summary.avgCci.toFixed(1)}
          description={`${dataset.summary.cciTrend >= 0 ? '+' : ''}${dataset.summary.cciTrend.toFixed(1)} vs last quarter`}
          icon={<BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />}
          trend={dataset.summary.cciTrend >= 0 ? 'up' : 'down'}
        />
        <StatCard
          title="Total clinicians"
          value={dataset.summary.totalClinicians.toString()}
          description="Active in system"
          icon={<Users2 className="h-5 w-5 text-primary" aria-hidden="true" />}
        />
        <StatCard
          title="At risk"
          value={dataset.summary.atRisk.toString()}
          description="CCI below 70"
          tone="warn"
          icon={<AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />}
        />
        <StatCard
          title="High performers"
          value={dataset.summary.highPerformers.toString()}
          description="CCI above 85"
          tone="success"
          icon={<TrendingUp className="h-5 w-5 text-emerald-600" aria-hidden="true" />}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>CCI Trend</CardTitle>
            <CardDescription>Organization-wide Clinical Competency Index over time</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              title=""
              description=""
              data={cciTrendData}
              valueFormatter={(value) => `${Math.round(value)}`}
              unitLabel="CCI"
              srHint="CCI trend chart showing organization-wide competency index over time"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fusion Score Trend</CardTitle>
            <CardDescription>Combined credential and quality signals</CardDescription>
          </CardHeader>
          <CardContent>
            <FusionTrendChart
              data={dataset.trend}
              title=""
              description=""
              initialView="combined"
              srHint="Fusion score trend showing combined credential and quality metrics"
            />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5 text-primary" aria-hidden="true" />
              Clinician Competency Overview
            </CardTitle>
            <CardDescription>Sortable by CCI, Fusion Score, or name. Filter by department.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative">
              <span className="sr-only">Search clinicians</span>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search..." className="pl-9" />
              <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </label>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === 'all' ? 'All departments' : dept}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Clinician
                    {sortBy === 'name' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                </TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort('cci')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    CCI
                    {sortBy === 'cci' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort('fusionScore')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Fusion Score
                    {sortBy === 'fusionScore' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                </TableHead>
                <TableHead>Strengths</TableHead>
                <TableHead>Risks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.map((row) => (
                <TableRow key={row.id} aria-label={`${row.name} competency profile`}>
                  <TableCell className="font-semibold">{row.name}</TableCell>
                  <TableCell>{row.department}</TableCell>
                  <TableCell className="text-muted-foreground">{row.specialty}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{row.cci.toFixed(1)}</span>
                      {row.cciTrend === 'up' && <TrendingUp className="h-4 w-4 text-emerald-600" aria-label="Trending up" />}
                      {row.cciTrend === 'down' && <TrendingDown className="h-4 w-4 text-rose-600" aria-label="Trending down" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-semibold">
                      {row.fusionScore}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.strengths.slice(0, 2).map((strength) => (
                        <Badge key={strength} variant="secondary" className="text-xs">
                          {strength}
                        </Badge>
                      ))}
                      {row.strengths.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{row.strengths.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.risks.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {row.risks
                          .filter((r) => r.severity === 'high')
                          .slice(0, 1)
                          .map((risk) => (
                            <Badge key={risk.domain} variant="destructive" className="text-xs">
                              {risk.domain}
                            </Badge>
                          ))}
                        {row.risks.filter((r) => r.severity === 'high').length === 0 &&
                          row.risks.slice(0, 1).map((risk) => (
                            <Badge key={risk.domain} variant="outline" className="border-amber-300 text-amber-900 text-xs">
                              {risk.domain}
                            </Badge>
                          ))}
                        {row.risks.length > 1 && (
                          <Badge variant="outline" className="text-xs">
                            +{row.risks.length - 1}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        None
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredAndSorted.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No clinicians match the current filters.</p>}
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Domain Performance</CardTitle>
            <CardDescription>Average scores by competency domain</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(['Clinical Skills', 'Patient Safety', 'Communication', 'Professionalism', 'Quality Metrics'] as CompetencyDomain[]).map((domain) => {
              const avgScore =
                filteredAndSorted.reduce((sum, row) => sum + row.domains[domain].score, 0) / (filteredAndSorted.length || 1)
              const riskCount = filteredAndSorted.filter((row) => row.domains[domain].risk === 'high').length
              return (
                <div key={domain} className="rounded-md border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{domain}</p>
                    <p className="font-semibold">{avgScore.toFixed(1)}</p>
                  </div>
                  {riskCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {riskCount} {riskCount === 1 ? 'clinician' : 'clinicians'} at high risk
                    </p>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Strengths</CardTitle>
            <CardDescription>Most common competency strengths</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(
              filteredAndSorted.reduce(
                (acc, row) => {
                  row.strengths.forEach((strength) => {
                    acc[strength] = (acc[strength] || 0) + 1
                  })
                  return acc
                },
                {} as Record<CompetencyDomain, number>,
              ),
            )
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([domain, count]) => (
                <div key={domain} className="rounded-md border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{domain}</p>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                </div>
              ))}
            {filteredAndSorted.length === 0 && <p className="text-sm text-muted-foreground">No data available.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Areas</CardTitle>
            <CardDescription>Domains requiring attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(
              filteredAndSorted.reduce(
                (acc, row) => {
                  row.risks.forEach((risk) => {
                    if (!acc[risk.domain]) {
                      acc[risk.domain] = { high: 0, medium: 0 }
                    }
                    acc[risk.domain][risk.severity]++
                  })
                  return acc
                },
                {} as Record<CompetencyDomain, { high: number; medium: number }>,
              ),
            )
              .sort(([, a], [, b]) => b.high - a.high || b.medium - a.medium)
              .slice(0, 5)
              .map(([domain, counts]) => (
                <div key={domain} className="rounded-md border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{domain}</p>
                    <div className="flex gap-1">
                      {counts.high > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {counts.high} high
                        </Badge>
                      )}
                      {counts.medium > 0 && (
                        <Badge variant="outline" className="border-amber-300 text-amber-900 text-xs">
                          {counts.medium} med
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            {filteredAndSorted.length === 0 && <p className="text-sm text-muted-foreground">No data available.</p>}
          </CardContent>
        </Card>
      </section>

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </div>
  )
}

function StatCard({
  title,
  value,
  description,
  icon,
  trend,
  tone,
}: {
  title: string
  value: string
  description: string
  icon: React.ReactNode
  trend?: 'up' | 'down'
  tone?: 'warn' | 'success'
}) {
  const accent = tone === 'warn' ? 'border-amber-200 bg-amber-50' : tone === 'success' ? 'border-emerald-200 bg-emerald-50' : 'border-primary/20 bg-primary/5'
  return (
    <Card className={cn('border', accent)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function buildMockData(): OrgCompetencyData {
  const now = new Date()
  const trend: FusionTrendDatum[] = []
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now)
    date.setMonth(date.getMonth() - i)
    trend.push({
      label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      date: date.toISOString(),
      combined: 78 + Math.random() * 8,
      credential: 82 + Math.random() * 6,
      quality: 74 + Math.random() * 10,
    })
  }

  const clinicians: CompetencyRow[] = [
    {
      id: 'cln-201',
      name: 'Dr. Maya Lennox',
      department: 'Cardiology',
      specialty: 'Interventional Cardiology',
      cci: 87.5,
      cciTrend: 'up',
      fusionScore: 89,
      domains: {
        'Clinical Skills': { score: 92, risk: 'low' },
        'Patient Safety': { score: 88, risk: 'low' },
        Communication: { score: 85, risk: 'low' },
        Professionalism: { score: 90, risk: 'low' },
        'Quality Metrics': { score: 86, risk: 'low' },
      },
      strengths: ['Clinical Skills', 'Professionalism'],
      risks: [],
      lastUpdated: now.toISOString(),
    },
    {
      id: 'cln-202',
      name: 'Dr. Leo Alvarez',
      department: 'Surgery',
      specialty: 'Orthopedic Surgery',
      cci: 72.3,
      cciTrend: 'down',
      fusionScore: 71,
      domains: {
        'Clinical Skills': { score: 75, risk: 'medium' },
        'Patient Safety': { score: 68, risk: 'high' },
        Communication: { score: 74, risk: 'medium' },
        Professionalism: { score: 70, risk: 'medium' },
        'Quality Metrics': { score: 72, risk: 'medium' },
      },
      strengths: ['Clinical Skills'],
      risks: [
        { domain: 'Patient Safety', severity: 'high', description: 'Recent safety incidents' },
        { domain: 'Communication', severity: 'medium', description: 'Documentation gaps' },
      ],
      lastUpdated: now.toISOString(),
    },
    {
      id: 'cln-203',
      name: 'PA. Mei Chen',
      department: 'Hospitalist',
      specialty: 'Hospital Medicine',
      cci: 91.2,
      cciTrend: 'up',
      fusionScore: 93,
      domains: {
        'Clinical Skills': { score: 94, risk: 'low' },
        'Patient Safety': { score: 92, risk: 'low' },
        Communication: { score: 89, risk: 'low' },
        Professionalism: { score: 91, risk: 'low' },
        'Quality Metrics': { score: 90, risk: 'low' },
      },
      strengths: ['Clinical Skills', 'Patient Safety', 'Quality Metrics'],
      risks: [],
      lastUpdated: now.toISOString(),
    },
    {
      id: 'cln-204',
      name: 'Dr. Ajay Patel',
      department: 'Neurosciences',
      specialty: 'Neurology',
      cci: 79.8,
      cciTrend: 'stable',
      fusionScore: 81,
      domains: {
        'Clinical Skills': { score: 82, risk: 'low' },
        'Patient Safety': { score: 78, risk: 'medium' },
        Communication: { score: 81, risk: 'low' },
        Professionalism: { score: 80, risk: 'low' },
        'Quality Metrics': { score: 77, risk: 'medium' },
      },
      strengths: ['Clinical Skills', 'Communication'],
      risks: [{ domain: 'Patient Safety', severity: 'medium', description: 'Minor documentation issues' }],
      lastUpdated: now.toISOString(),
    },
    {
      id: 'cln-205',
      name: 'NP. Lina Romero',
      department: 'Primary Care',
      specialty: 'Primary Care',
      cci: 84.6,
      cciTrend: 'up',
      fusionScore: 86,
      domains: {
        'Clinical Skills': { score: 86, risk: 'low' },
        'Patient Safety': { score: 85, risk: 'low' },
        Communication: { score: 88, risk: 'low' },
        Professionalism: { score: 83, risk: 'low' },
        'Quality Metrics': { score: 85, risk: 'low' },
      },
      strengths: ['Communication', 'Patient Safety'],
      risks: [],
      lastUpdated: now.toISOString(),
    },
  ]

  const avgCci = clinicians.reduce((sum, c) => sum + c.cci, 0) / clinicians.length
  const cciTrend = 2.3 // Mock trend
  const atRisk = clinicians.filter((c) => c.cci < 70).length
  const highPerformers = clinicians.filter((c) => c.cci > 85).length

  return {
    summary: {
      avgCci,
      cciTrend,
      totalClinicians: clinicians.length,
      atRisk,
      highPerformers,
    },
    trend,
    clinicians,
  }
}

