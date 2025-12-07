'use client'

import { useMemo, useState } from 'react'
import { BarChart3, Filter, Search, TrendingDown, TrendingUp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FusionScoreBadge } from '@/components/fusion/FusionScoreBadge'
import { cn } from '@/lib/utils'

type CompetencyDomain = 'Clinical Skills' | 'Patient Safety' | 'Communication' | 'Professionalism' | 'Quality Metrics'

type ComparisonRow = {
  id: string
  name: string
  organization?: string
  specialty: string
  department: string
  cci: number
  cciTrend: 'up' | 'down' | 'stable'
  fusionScore: number
  domains: Record<CompetencyDomain, number>
  lastUpdated: string
}

type ComparisonData = {
  clinicians: ComparisonRow[]
  organizations: string[]
  departments: string[]
  specialties: string[]
}

export default function CompetencyComparisonPage() {
  const dataset = useMemo(() => buildMockComparisonData(), [])
  const [search, setSearch] = useState('')
  const [orgFilter, setOrgFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [specialtyFilter, setSpecialtyFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'cci' | 'fusionScore' | 'name'>('cci')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [selectedDomain, setSelectedDomain] = useState<CompetencyDomain | 'all'>('all')
  const [srMessage, setSrMessage] = useState('')

  const filteredAndSorted = useMemo(() => {
    let filtered = dataset.clinicians.filter((row) => {
      const matchesSearch =
        !search ||
        row.name.toLowerCase().includes(search.toLowerCase()) ||
        row.specialty.toLowerCase().includes(search.toLowerCase()) ||
        row.department.toLowerCase().includes(search.toLowerCase()) ||
        (row.organization && row.organization.toLowerCase().includes(search.toLowerCase()))
      const matchesOrg = orgFilter === 'all' || row.organization === orgFilter || (!row.organization && orgFilter === 'current')
      const matchesDepartment = departmentFilter === 'all' || row.department === departmentFilter
      const matchesSpecialty = specialtyFilter === 'all' || row.specialty === specialtyFilter
      return matchesSearch && matchesOrg && matchesDepartment && matchesSpecialty
    })

    filtered.sort((a, b) => {
      let aVal: number | string
      let bVal: number | string

      if (selectedDomain !== 'all') {
        aVal = a.domains[selectedDomain]
        bVal = b.domains[selectedDomain]
      } else {
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
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      return sortDirection === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal))
    })

    return filtered
  }, [dataset.clinicians, search, orgFilter, departmentFilter, specialtyFilter, sortBy, sortDirection, selectedDomain])

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

  const domainStats = useMemo(() => {
    if (selectedDomain === 'all' || filteredAndSorted.length === 0) return null

    const values = filteredAndSorted.map((row) => row.domains[selectedDomain])
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length
    const min = Math.min(...values)
    const max = Math.max(...values)

    return { avg, min, max }
  }, [filteredAndSorted, selectedDomain])

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Org • Competency • Compare</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary" aria-hidden="true" />
              Competency Comparison
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Compare clinicians by domain across organizations. Supports search, sort, and filter by department, specialty, or organization. Uses FusionScore + CCI.
            </p>
          </div>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
          <CardDescription>Filter and search clinicians for comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="relative">
              <span className="sr-only">Search clinicians</span>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search..." className="pl-9" />
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </label>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={orgFilter}
              onChange={(event) => setOrgFilter(event.target.value)}
            >
              <option value="all">All organizations</option>
              <option value="current">Current org only</option>
              {dataset.organizations.map((org) => (
                <option key={org} value={org}>
                  {org}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
            >
              <option value="all">All departments</option>
              {dataset.departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={specialtyFilter}
              onChange={(event) => setSpecialtyFilter(event.target.value)}
            >
              <option value="all">All specialties</option>
              {dataset.specialties.map((spec) => (
                <option key={spec} value={spec}>
                  {spec}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />
              Clinician Comparison
            </CardTitle>
            <CardDescription>
              {filteredAndSorted.length} {filteredAndSorted.length === 1 ? 'clinician' : 'clinicians'} found
              {selectedDomain !== 'all' && domainStats && (
                <span className="ml-2">
                  • {selectedDomain} avg: {domainStats.avg.toFixed(1)} (range: {domainStats.min.toFixed(1)}-{domainStats.max.toFixed(1)})
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={selectedDomain}
              onChange={(event) => setSelectedDomain(event.target.value as CompetencyDomain | 'all')}
            >
              <option value="all">All domains</option>
              {(['Clinical Skills', 'Patient Safety', 'Communication', 'Professionalism', 'Quality Metrics'] as CompetencyDomain[]).map((domain) => (
                <option key={domain} value={domain}>
                  {domain}
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
                {orgFilter === 'all' && <TableHead>Organization</TableHead>}
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
                {selectedDomain === 'all' ? (
                  <>
                    <TableHead>Clinical Skills</TableHead>
                    <TableHead>Patient Safety</TableHead>
                    <TableHead>Communication</TableHead>
                    <TableHead>Professionalism</TableHead>
                    <TableHead>Quality Metrics</TableHead>
                  </>
                ) : (
                  <TableHead>{selectedDomain}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.map((row) => (
                <TableRow key={row.id} aria-label={`${row.name} competency comparison`}>
                  <TableCell className="font-semibold">{row.name}</TableCell>
                  {orgFilter === 'all' && (
                    <TableCell>{row.organization || <span className="text-muted-foreground">Current org</span>}</TableCell>
                  )}
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
                    <div className="flex items-center">
                      <FusionScoreBadge score={row.fusionScore} label="" size="default" className="scale-75 origin-left" />
                    </div>
                  </TableCell>
                  {selectedDomain === 'all' ? (
                    <>
                      <TableCell>
                        <Badge variant="outline" className="font-semibold">
                          {row.domains['Clinical Skills']}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-semibold">
                          {row.domains['Patient Safety']}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-semibold">
                          {row.domains.Communication}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-semibold">
                          {row.domains.Professionalism}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-semibold">
                          {row.domains['Quality Metrics']}
                        </Badge>
                      </TableCell>
                    </>
                  ) : (
                    <TableCell>
                      <Badge variant="outline" className="font-semibold">
                        {row.domains[selectedDomain]}
                      </Badge>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredAndSorted.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No clinicians match the current filters.</p>}
        </CardContent>
      </Card>

      {filteredAndSorted.length > 0 && (
        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Average CCI</CardTitle>
              <CardDescription>Across filtered clinicians</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {(filteredAndSorted.reduce((sum, row) => sum + row.cci, 0) / filteredAndSorted.length).toFixed(1)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Average Fusion Score</CardTitle>
              <CardDescription>Across filtered clinicians</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {Math.round(filteredAndSorted.reduce((sum, row) => sum + row.fusionScore, 0) / filteredAndSorted.length)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Top Performer</CardTitle>
              <CardDescription>Highest CCI in comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">
                {filteredAndSorted.reduce((top, row) => (row.cci > top.cci ? row : top), filteredAndSorted[0])?.name}
              </p>
              <p className="text-sm text-muted-foreground">
                CCI:{' '}
                {filteredAndSorted.reduce((top, row) => (row.cci > top.cci ? row : top), filteredAndSorted[0])?.cci.toFixed(1)}
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </div>
  )
}

function buildMockComparisonData(): ComparisonData {
  const now = new Date().toISOString()
  const clinicians: ComparisonRow[] = [
    {
      id: 'cln-301',
      name: 'Dr. Maya Lennox',
      organization: 'Northwind Medical Center',
      specialty: 'Interventional Cardiology',
      department: 'Cardiology',
      cci: 87.5,
      cciTrend: 'up',
      fusionScore: 89,
      domains: {
        'Clinical Skills': 92,
        'Patient Safety': 88,
        Communication: 85,
        Professionalism: 90,
        'Quality Metrics': 86,
      },
      lastUpdated: now,
    },
    {
      id: 'cln-302',
      name: 'Dr. Leo Alvarez',
      organization: 'Southside Hospital',
      specialty: 'Orthopedic Surgery',
      department: 'Surgery',
      cci: 72.3,
      cciTrend: 'down',
      fusionScore: 71,
      domains: {
        'Clinical Skills': 75,
        'Patient Safety': 68,
        Communication: 74,
        Professionalism: 70,
        'Quality Metrics': 72,
      },
      lastUpdated: now,
    },
    {
      id: 'cln-303',
      name: 'PA. Mei Chen',
      organization: 'Northwind Medical Center',
      specialty: 'Hospital Medicine',
      department: 'Hospitalist',
      cci: 91.2,
      cciTrend: 'up',
      fusionScore: 93,
      domains: {
        'Clinical Skills': 94,
        'Patient Safety': 92,
        Communication: 89,
        Professionalism: 91,
        'Quality Metrics': 90,
      },
      lastUpdated: now,
    },
    {
      id: 'cln-304',
      name: 'Dr. Ajay Patel',
      organization: 'Northwind Medical Center',
      specialty: 'Neurology',
      department: 'Neurosciences',
      cci: 79.8,
      cciTrend: 'stable',
      fusionScore: 81,
      domains: {
        'Clinical Skills': 82,
        'Patient Safety': 78,
        Communication: 81,
        Professionalism: 80,
        'Quality Metrics': 77,
      },
      lastUpdated: now,
    },
    {
      id: 'cln-305',
      name: 'NP. Lina Romero',
      organization: 'Northwind Medical Center',
      specialty: 'Primary Care',
      department: 'Primary Care',
      cci: 84.6,
      cciTrend: 'up',
      fusionScore: 86,
      domains: {
        'Clinical Skills': 86,
        'Patient Safety': 85,
        Communication: 88,
        Professionalism: 83,
        'Quality Metrics': 85,
      },
      lastUpdated: now,
    },
    {
      id: 'cln-306',
      name: 'Dr. Sarah Kim',
      organization: 'Southside Hospital',
      specialty: 'Interventional Cardiology',
      department: 'Cardiology',
      cci: 85.1,
      cciTrend: 'up',
      fusionScore: 87,
      domains: {
        'Clinical Skills': 88,
        'Patient Safety': 84,
        Communication: 86,
        Professionalism: 85,
        'Quality Metrics': 83,
      },
      lastUpdated: now,
    },
  ]

  const organizations = Array.from(new Set(clinicians.map((c) => c.organization).filter(Boolean))) as string[]
  const departments = Array.from(new Set(clinicians.map((c) => c.department)))
  const specialties = Array.from(new Set(clinicians.map((c) => c.specialty)))

  return {
    clinicians,
    organizations,
    departments,
    specialties,
  }
}

