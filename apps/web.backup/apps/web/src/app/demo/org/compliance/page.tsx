'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileText, Filter, ShieldAlert, Users2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

type ComplianceStatus = 'PASS' | 'WARN' | 'FAIL'

type ClinicianComplianceRow = {
  id: string
  name: string
  specialty: string
  department: string
  statuses: Record<'CR1' | 'CR2' | 'CR3' | 'CR4' | 'CR5' | 'TJC', ComplianceStatus>
  overduePsv?: number
  missingEvidence?: string[]
  lastUpdated: string
}

export default function OrgComplianceDashboardPage() {
  const dataset = useMemo(() => buildMockRoster(), [])
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'ALL' | ComplianceStatus>('ALL')
  const [srMessage, setSrMessage] = useState('')

  const departments = useMemo(() => {
    return ['all', ...new Set(dataset.map((row) => row.department))]
  }, [dataset])

  const filteredRows = useMemo(() => {
    return dataset.filter((row) => {
      const matchesSearch =
        !search ||
        row.name.toLowerCase().includes(search.toLowerCase()) ||
        row.specialty.toLowerCase().includes(search.toLowerCase())
      const matchesDepartment = departmentFilter === 'all' || row.department === departmentFilter
      const matchesStatus =
        statusFilter === 'ALL' ||
        Object.values(row.statuses).some((status) => status === statusFilter)
      return matchesSearch && matchesDepartment && matchesStatus
    })
  }, [dataset, search, departmentFilter, statusFilter])

  const summary = useMemo(() => {
    const stats = { pass: 0, warn: 0, fail: 0 }
    dataset.forEach((row) => {
      const statuses = Object.values(row.statuses)
      if (statuses.includes('FAIL')) {
        stats.fail += 1
      } else if (statuses.includes('WARN')) {
        stats.warn += 1
      } else {
        stats.pass += 1
      }
    })
    return stats
  }, [dataset])

  const handleExport = async (mode: 'csv' | 'pdf') => {
    setSrMessage(`Preparing ${mode.toUpperCase()} export for ${filteredRows.length} clinicians`)
    await wait(800)
    setSrMessage(`${mode.toUpperCase()} export ready`)
    setTimeout(() => setSrMessage(''), 2500)
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Org • Compliance</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-primary" aria-hidden="true" />
              Org Compliance Dashboard
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Track NCQA CR1-CR5 and Joint Commission readiness for every clinician. Filters update the export buttons and aria-live announcements describe changes for screen reader users.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleExport('csv')}>
              <FileText className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </Button>
            <Button onClick={() => handleExport('pdf')}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export PDF
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Fully compliant"
          value={`${summary.pass}`}
          description="No WARN or FAIL signals"
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />}
        />
        <StatCard
          title="Warnings open"
          value={`${summary.warn}`}
          description="Needs follow-up (CR or TJC)"
          tone="warn"
          icon={<AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />}
        />
        <StatCard
          title="Failures blocking"
          value={`${summary.fail}`}
          description="Escalated to MSO"
          tone="fail"
          icon={<ShieldAlert className="h-5 w-5 text-rose-600" aria-hidden="true" />}
        />
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5 text-primary" aria-hidden="true" />
              Clinician compliance tracker
            </CardTitle>
            <CardDescription>Color-coded CR1–CR5 + TJC statuses, filterable by department or alert level.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative">
              <span className="sr-only">Search clinicians</span>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clinician or specialty" className="pl-9" />
              <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </label>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === 'all' ? 'All departments' : dept}
                </option>
              ))}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              {['ALL', 'PASS', 'WARN', 'FAIL'].map((status) => (
                <option key={status} value={status}>
                  {status === 'ALL' ? 'All statuses' : status}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinician</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>CR1</TableHead>
                <TableHead>CR2</TableHead>
                <TableHead>CR3</TableHead>
                <TableHead>CR4</TableHead>
                <TableHead>CR5</TableHead>
                <TableHead>TJC</TableHead>
                <TableHead>Alerts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.id} aria-label={`${row.name} compliance statuses`}>
                  <TableCell className="font-semibold">{row.name}</TableCell>
                  <TableCell>{row.department}</TableCell>
                  <TableCell className="text-muted-foreground">{row.specialty}</TableCell>
                  {(['CR1', 'CR2', 'CR3', 'CR4', 'CR5', 'TJC'] as const).map((rule) => (
                    <TableCell key={`${row.id}-${rule}`}>
                      <StatusBadge status={row.statuses[rule]} label={rule} />
                    </TableCell>
                  ))}
                  <TableCell>
                    {row.missingEvidence?.length ? (
                      <Badge variant="outline" className="border-amber-300 text-amber-900">
                        {row.missingEvidence.length} missing
                      </Badge>
                    ) : row.overduePsv ? (
                      <Badge variant="outline" className="border-rose-300 text-rose-900">
                        PSV {row.overduePsv}d
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Clear</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredRows.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No clinicians match the current filters.</p>}
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2" aria-label="Evidence gaps">
        <Card>
          <CardHeader>
            <CardTitle>Overdue PSV</CardTitle>
            <CardDescription>Primary source verifications over 150 days old.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dataset
              .filter((row) => row.overduePsv)
              .map((row) => (
                <div key={row.id} className="rounded-md border px-3 py-2">
                  <p className="font-medium">{row.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {row.overduePsv} days overdue • {row.department}
                  </p>
                </div>
              ))}
            {!dataset.some((row) => row.overduePsv) && <p className="text-sm text-muted-foreground">No overdue PSV items 🎉</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Missing evidence</CardTitle>
            <CardDescription>CR4 / CR5 documentation gaps flagged for audit packet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dataset
              .filter((row) => row.missingEvidence && row.missingEvidence.length > 0)
              .map((row) => (
                <div key={row.id} className="rounded-md border px-3 py-2 space-y-1">
                  <p className="font-medium">{row.name}</p>
                  <ul className="list-disc pl-4 text-sm text-muted-foreground">
                    {row.missingEvidence?.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                </div>
              ))}
            {!dataset.some((row) => row.missingEvidence?.length) && <p className="text-sm text-muted-foreground">All evidence packets complete.</p>}
          </CardContent>
        </Card>
      </section>

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </div>
  )
}

function StatusBadge({ status, label }: { status: ComplianceStatus; label: string }) {
  const tone =
    status === 'FAIL' ? 'bg-rose-100 text-rose-700 border border-rose-200' : status === 'WARN' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
  return (
    <Badge variant="outline" className={cn('rounded-full px-3 py-1 text-xs font-semibold', tone)}>
      <span className="sr-only">{label} status </span>
      {status}
    </Badge>
  )
}

function StatCard({ title, value, description, icon, tone }: { title: string; value: string; description: string; icon?: ReactNode; tone?: 'warn' | 'fail' }) {
  const accent = tone === 'fail' ? 'border-rose-200 bg-rose-50' : tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
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

function buildMockRoster(): ClinicianComplianceRow[] {
  const now = new Date().toISOString()
  return [
    {
      id: 'cln-101',
      name: 'Dr. Maya Lennox',
      specialty: 'Interventional Cardiology',
      department: 'Cardiology',
      statuses: { CR1: 'PASS', CR2: 'PASS', CR3: 'PASS', CR4: 'PASS', CR5: 'WARN', TJC: 'WARN' },
      missingEvidence: ['CR5 OPPE note (Nov 2025)'],
      lastUpdated: now,
    },
    {
      id: 'cln-102',
      name: 'Dr. Leo Alvarez',
      specialty: 'Orthopedic Surgery',
      department: 'Surgery',
      statuses: { CR1: 'FAIL', CR2: 'WARN', CR3: 'WARN', CR4: 'PASS', CR5: 'WARN', TJC: 'FAIL' },
      overduePsv: 34,
      missingEvidence: ['TJC FPPE completion note'],
      lastUpdated: now,
    },
    {
      id: 'cln-103',
      name: 'PA. Mei Chen',
      specialty: 'Hospital Medicine',
      department: 'Hospitalist',
      statuses: { CR1: 'PASS', CR2: 'PASS', CR3: 'PASS', CR4: 'PASS', CR5: 'PASS', TJC: 'PASS' },
      lastUpdated: now,
    },
    {
      id: 'cln-104',
      name: 'Dr. Ajay Patel',
      specialty: 'Neurology',
      department: 'Neurosciences',
      statuses: { CR1: 'WARN', CR2: 'PASS', CR3: 'PASS', CR4: 'PASS', CR5: 'PASS', TJC: 'WARN' },
      overduePsv: 12,
      lastUpdated: now,
    },
    {
      id: 'cln-105',
      name: 'NP. Lina Romero',
      specialty: 'Primary Care',
      department: 'Primary Care',
      statuses: { CR1: 'PASS', CR2: 'PASS', CR3: 'WARN', CR4: 'PASS', CR5: 'PASS', TJC: 'PASS' },
      missingEvidence: ['CR3 practitioner rights attestation'],
      lastUpdated: now,
    },
  ]
}

function wait(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration))
}

'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileText, Filter, ShieldAlert, Users2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

type ComplianceStatus = 'PASS' | 'WARN' | 'FAIL'

type ClinicianComplianceRow = {
  id: string
  name: string
  specialty: string
  department: string
  statuses: Record<'CR1' | 'CR2' | 'CR3' | 'CR4' | 'CR5' | 'TJC', ComplianceStatus>
  overduePsv?: number
  missingEvidence?: string[]
  lastUpdated: string
}

export default function OrgComplianceDashboardPage() {
  const dataset = useMemo(() => buildMockRoster(), [])
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'ALL' | ComplianceStatus>('ALL')
  const [srMessage, setSrMessage] = useState('')

  const departments = useMemo(() => {
    return ['all', ...new Set(dataset.map((row) => row.department))]
  }, [dataset])

  const filteredRows = useMemo(() => {
    return dataset.filter((row) => {
      const matchesSearch =
        !search ||
        row.name.toLowerCase().includes(search.toLowerCase()) ||
        row.specialty.toLowerCase().includes(search.toLowerCase())
      const matchesDepartment = departmentFilter === 'all' || row.department === departmentFilter
      const matchesStatus =
        statusFilter === 'ALL' ||
        Object.values(row.statuses).some((status) => status === statusFilter)
      return matchesSearch && matchesDepartment && matchesStatus
    })
  }, [dataset, search, departmentFilter, statusFilter])

  const summary = useMemo(() => {
    const stats = { pass: 0, warn: 0, fail: 0 }
    dataset.forEach((row) => {
      const statuses = Object.values(row.statuses)
      if (statuses.includes('FAIL')) {
        stats.fail += 1
      } else if (statuses.includes('WARN')) {
        stats.warn += 1
      } else {
        stats.pass += 1
      }
    })
    return stats
  }, [dataset])

  const handleExport = async (mode: 'csv' | 'pdf') => {
    setSrMessage(`Preparing ${mode.toUpperCase()} export for ${filteredRows.length} clinicians`)
    await wait(800)
    setSrMessage(`${mode.toUpperCase()} export ready`)
    setTimeout(() => setSrMessage(''), 2500)
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Org • Compliance</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-primary" aria-hidden="true" />
              Org Compliance Dashboard
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Track NCQA CR1-CR5 and Joint Commission readiness for every clinician. Filters update the export buttons and aria-live announcements describe changes for screen reader users.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleExport('csv')}>
              <FileText className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </Button>
            <Button onClick={() => handleExport('pdf')}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export PDF
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Fully compliant"
          value={`${summary.pass}`}
          description="No WARN or FAIL signals"
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />}
        />
        <StatCard
          title="Warnings open"
          value={`${summary.warn}`}
          description="Needs follow-up (CR or TJC)"
          tone="warn"
          icon={<AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />}
        />
        <StatCard
          title="Failures blocking"
          value={`${summary.fail}`}
          description="Escalated to MSO"
          tone="fail"
          icon={<ShieldAlert className="h-5 w-5 text-rose-600" aria-hidden="true" />}
        />
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5 text-primary" aria-hidden="true" />
              Clinician compliance tracker
            </CardTitle>
            <CardDescription>Color-coded CR1–CR5 + TJC statuses, filterable by department or alert level.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative">
              <span className="sr-only">Search clinicians</span>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clinician or specialty" className="pl-9" />
              <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </label>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === 'all' ? 'All departments' : dept}
                </option>
              ))}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              {['ALL', 'PASS', 'WARN', 'FAIL'].map((status) => (
                <option key={status} value={status}>
                  {status === 'ALL' ? 'All statuses' : status}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinician</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>CR1</TableHead>
                <TableHead>CR2</TableHead>
                <TableHead>CR3</TableHead>
                <TableHead>CR4</TableHead>
                <TableHead>CR5</TableHead>
                <TableHead>TJC</TableHead>
                <TableHead>Alerts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.id} aria-label={`${row.name} compliance statuses`}>
                  <TableCell className="font-semibold">{row.name}</TableCell>
                  <TableCell>{row.department}</TableCell>
                  <TableCell className="text-muted-foreground">{row.specialty}</TableCell>
                  {(['CR1', 'CR2', 'CR3', 'CR4', 'CR5', 'TJC'] as const).map((rule) => (
                    <TableCell key={`${row.id}-${rule}`}>
                      <StatusBadge status={row.statuses[rule]} label={rule} />
                    </TableCell>
                  ))}
                  <TableCell>
                    {row.missingEvidence?.length ? (
                      <Badge variant="outline" className="border-amber-300 text-amber-900">
                        {row.missingEvidence.length} missing
                      </Badge>
                    ) : row.overduePsv ? (
                      <Badge variant="outline" className="border-rose-300 text-rose-900">
                        PSV {row.overduePsv}d
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Clear</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredRows.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No clinicians match the current filters.</p>}
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2" aria-label="Evidence gaps">
        <Card>
          <CardHeader>
            <CardTitle>Overdue PSV</CardTitle>
            <CardDescription>Primary source verifications over 150 days old.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dataset
              .filter((row) => row.overduePsv)
              .map((row) => (
                <div key={row.id} className="rounded-md border px-3 py-2">
                  <p className="font-medium">{row.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {row.overduePsv} days overdue • {row.department}
                  </p>
                </div>
              ))}
            {!dataset.some((row) => row.overduePsv) && <p className="text-sm text-muted-foreground">No overdue PSV items 🎉</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Missing evidence</CardTitle>
            <CardDescription>CR4 / CR5 documentation gaps flagged for audit packet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dataset
              .filter((row) => row.missingEvidence && row.missingEvidence.length > 0)
              .map((row) => (
                <div key={row.id} className="rounded-md border px-3 py-2 space-y-1">
                  <p className="font-medium">{row.name}</p>
                  <ul className="list-disc pl-4 text-sm text-muted-foreground">
                    {row.missingEvidence?.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                </div>
              ))}
            {!dataset.some((row) => row.missingEvidence?.length) && <p className="text-sm text-muted-foreground">All evidence packets complete.</p>}
          </CardContent>
        </Card>
      </section>

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </div>
  )
}

function StatusBadge({ status, label }: { status: ComplianceStatus; label: string }) {
  const tone =
    status === 'FAIL' ? 'bg-rose-100 text-rose-700 border border-rose-200' : status === 'WARN' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
  return (
    <Badge variant="outline" className={cn('rounded-full px-3 py-1 text-xs font-semibold', tone)}>
      <span className="sr-only">{label} status </span>
      {status}
    </Badge>
  )
}

function StatCard({ title, value, description, icon, tone }: { title: string; value: string; description: string; icon?: ReactNode; tone?: 'warn' | 'fail' }) {
  const accent = tone === 'fail' ? 'border-rose-200 bg-rose-50' : tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
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

function buildMockRoster(): ClinicianComplianceRow[] {
  const now = new Date().toISOString()
  return [
    {
      id: 'cln-101',
      name: 'Dr. Maya Lennox',
      specialty: 'Interventional Cardiology',
      department: 'Cardiology',
      statuses: { CR1: 'PASS', CR2: 'PASS', CR3: 'PASS', CR4: 'PASS', CR5: 'WARN', TJC: 'WARN' },
      missingEvidence: ['CR5 OPPE note (Nov 2025)'],
      lastUpdated: now,
    },
    {
      id: 'cln-102',
      name: 'Dr. Leo Alvarez',
      specialty: 'Orthopedic Surgery',
      department: 'Surgery',
      statuses: { CR1: 'FAIL', CR2: 'WARN', CR3: 'WARN', CR4: 'PASS', CR5: 'WARN', TJC: 'FAIL' },
      overduePsv: 34,
      missingEvidence: ['TJC FPPE completion note'],
      lastUpdated: now,
    },
    {
      id: 'cln-103',
      name: 'PA. Mei Chen',
      specialty: 'Hospital Medicine',
      department: 'Hospitalist',
      statuses: { CR1: 'PASS', CR2: 'PASS', CR3: 'PASS', CR4: 'PASS', CR5: 'PASS', TJC: 'PASS' },
      lastUpdated: now,
    },
    {
      id: 'cln-104',
      name: 'Dr. Ajay Patel',
      specialty: 'Neurology',
      department: 'Neurosciences',
      statuses: { CR1: 'WARN', CR2: 'PASS', CR3: 'PASS', CR4: 'PASS', CR5: 'PASS', TJC: 'WARN' },
      overduePsv: 12,
      lastUpdated: now,
    },
    {
      id: 'cln-105',
      name: 'NP. Lina Romero',
      specialty: 'Primary Care',
      department: 'Primary Care',
      statuses: { CR1: 'PASS', CR2: 'PASS', CR3: 'WARN', CR4: 'PASS', CR5: 'PASS', TJC: 'PASS' },
      missingEvidence: ['CR3 practitioner rights attestation'],
      lastUpdated: now,
    },
  ]
}

function wait(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration))
}


