'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardCheck, Download, FileText, Shield } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type ComplianceStatus = 'PASS' | 'WARN' | 'FAIL'

type RuleDetail = {
  id: string
  name: string
  status: ComplianceStatus
  description: string
  evidence: string
  updatedAt: string
}

type ClinicianComplianceSummary = {
  clinician: {
    name: string
    credentialId: string
    specialty: string
    facility: string
    npi: string
  }
  ncqa: RuleDetail[]
  tjc: RuleDetail[]
  overduePsv: Array<{ source: string; daysOverdue: number; action: string }>
  missingEvidence: Array<{ requirement: string; owner: string; dueBy: string }>
  readinessScore: number
  nextReview: {
    committee: string
    due: string
    reviewers: string[]
  }
}

export default function ClinicianComplianceSummaryPage() {
  const summary = useMemo(() => buildMockSummary(), [])
  const [srMessage, setSrMessage] = useState('')

  const handleDownload = async (mode: 'ncqa' | 'tjc') => {
    const label = mode === 'ncqa' ? 'NCQA packet' : 'TJC packet'
    setSrMessage(`Preparing ${label} for ${summary.clinician.name}`)
    await wait(900)
    setSrMessage(`${label} ready with current evidence`)
    setTimeout(() => setSrMessage(''), 2600)
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Clinician • Compliance</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" aria-hidden="true" />
              Clinician Compliance Summary
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              NCQA CR1-CR5 and Joint Commission readiness for {summary.clinician.name}. Outstanding PSV or evidence gaps are listed with owners and due dates.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleDownload('ncqa')}>
              <FileText className="h-4 w-4" aria-hidden="true" />
              Download NCQA packet
            </Button>
            <Button onClick={() => handleDownload('tjc')}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Download TJC packet
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Snapshot metrics">
        <MetricCard title="Readiness score" value={`${summary.readinessScore}%`} description="Automated compliance grade" icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />} />
        <MetricCard title="Overdue PSV" value={`${summary.overduePsv.length}`} description="Items older than 150 days" tone="warn" icon={<CalendarClock className="h-5 w-5 text-amber-500" aria-hidden="true" />} />
        <MetricCard title="Missing evidence" value={`${summary.missingEvidence.length}`} description="CR4/CR5 documents" tone={summary.missingEvidence.length ? 'warn' : undefined} icon={<ClipboardCheck className="h-5 w-5 text-primary" aria-hidden="true" />} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Clinician profile</CardTitle>
          <CardDescription>Identifiers synced with committee packet.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {[
            { label: 'Name', value: summary.clinician.name },
            { label: 'Credential ID', value: summary.clinician.credentialId },
            { label: 'Specialty', value: summary.clinician.specialty },
            { label: 'Facility', value: summary.clinician.facility },
            { label: 'NPI', value: summary.clinician.npi },
            { label: 'Next committee review', value: `${summary.nextReview.committee} (${summary.nextReview.due})` },
          ].map((item) => (
            <div key={item.label} className="rounded-md border bg-muted/30 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className="font-semibold">{item.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <ComplianceTable title="NCQA CR1-CR5" description="Automated checks mapped to CR elements." rules={summary.ncqa} />
        <ComplianceTable title="Joint Commission readiness" description="Focus on MS.08.01.03 FPPE / OPPE review items." rules={summary.tjc} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overdue PSV</CardTitle>
            <CardDescription>Primary source verifications older than 150 days.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.overduePsv.map((item) => (
              <div key={item.source} className="rounded-md border px-3 py-2">
                <p className="font-medium">{item.source}</p>
                <p className="text-sm text-muted-foreground">
                  {item.daysOverdue} days overdue • {item.action}
                </p>
              </div>
            ))}
            {summary.overduePsv.length === 0 && <p className="text-sm text-muted-foreground">All PSV items current.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Missing evidence</CardTitle>
            <CardDescription>Documentation blockers tied to CR or TJC clauses.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.missingEvidence.map((gap) => (
              <div key={gap.requirement} className="rounded-md border px-3 py-2">
                <p className="font-medium">{gap.requirement}</p>
                <p className="text-sm text-muted-foreground">
                  Owner {gap.owner} • Due {gap.dueBy}
                </p>
              </div>
            ))}
            {summary.missingEvidence.length === 0 && <p className="text-sm text-muted-foreground">No open evidence tasks.</p>}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Next committee touchpoint</CardTitle>
          <CardDescription>Automatically mirrors committee packet timeline so compliance teams stay aligned.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Committee: <span className="font-semibold text-foreground">{summary.nextReview.committee}</span>
          </p>
          <p>Due: {summary.nextReview.due}</p>
          <p>Reviewers: {summary.nextReview.reviewers.join(', ')}</p>
        </CardContent>
      </Card>

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </div>
  )
}

function ComplianceTable({ title, description, rules }: { title: string; description: string; rules: RuleDetail[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requirement</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Evidence</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>
                  <p className="font-medium">{rule.name}</p>
                  <p className="text-sm text-muted-foreground">{rule.description}</p>
                </TableCell>
                <TableCell>
                  <StatusBadge status={rule.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{rule.evidence}</TableCell>
                <TableCell>{rule.updatedAt}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: ComplianceStatus }) {
  if (status === 'FAIL') {
    return (
      <Badge variant="destructive" className="gap-2">
        <Shield className="h-3.5 w-3.5" aria-hidden="true" />
        Fail
      </Badge>
    )
  }
  if (status === 'WARN') {
    return (
      <Badge variant="outline" className="gap-2 border-amber-300 text-amber-900">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        Warn
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-2">
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
      Pass
    </Badge>
  )
}

function MetricCard({ title, value, description, icon, tone }: { title: string; value: string; description: string; icon: ReactNode; tone?: 'warn' }) {
  return (
    <Card className={tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}>
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

function buildMockSummary(): ClinicianComplianceSummary {
  return {
    clinician: {
      name: 'Dr. Maya Lennox',
      credentialId: 'ORG-CC-9845',
      specialty: 'Interventional Cardiology',
      facility: 'Northwind Medical Center',
      npi: '1750392145',
    },
    ncqa: [
      {
        id: 'CR1.A',
        name: 'CR1.A • PSV window',
        status: 'PASS',
        description: 'Primary source verification within 180 days of committee approval.',
        evidence: 'PSV bundle anchored Oct 29',
        updatedAt: 'Nov 15, 2025',
      },
      {
        id: 'CR2.A',
        name: 'CR2.A • Recredentialing cycle',
        status: 'PASS',
        description: '36-month cycle with reminders and escalation.',
        evidence: 'Workflow auto-scheduled for 2026-03',
        updatedAt: 'Nov 13, 2025',
      },
      {
        id: 'CR3.A',
        name: 'CR3.A • Practitioner rights',
        status: 'WARN',
        description: 'Rights letter acknowledgement pending upload.',
        evidence: 'Awaiting signed acknowledgement',
        updatedAt: 'Nov 10, 2025',
      },
      {
        id: 'CR4.B',
        name: 'CR4.B • Credential file completeness',
        status: 'PASS',
        description: 'File audit checklist at 100%.',
        evidence: 'Audit sample uploaded',
        updatedAt: 'Nov 12, 2025',
      },
      {
        id: 'CR5.A',
        name: 'CR5.A • OPPE data present',
        status: 'WARN',
        description: 'OPPE dashboard flagged sedation checklist gap.',
        evidence: 'OPPE trend attached; investigation open',
        updatedAt: 'Nov 14, 2025',
      },
    ],
    tjc: [
      {
        id: 'MS.08.01.03',
        name: 'MS.08.01.03 FPPE',
        status: 'WARN',
        description: 'Focused review still pending imaging sign-off.',
        evidence: 'FPPE tracker assigned to imaging lead',
        updatedAt: 'Nov 15, 2025',
      },
      {
        id: 'MS.08.01.01',
        name: 'MS.08.01.01 OPPE',
        status: 'PASS',
        description: 'Ongoing professional practice evaluation complete.',
        evidence: 'OPPE summary exported Nov 12',
        updatedAt: 'Nov 12, 2025',
      },
    ],
    overduePsv: [
      { source: 'Anthem payer audit', daysOverdue: 17, action: 'Upload robotics case narrative' },
    ],
    missingEvidence: [
      { requirement: 'CR3 practitioner rights acknowledgement', owner: 'Credentialing analyst', dueBy: 'Nov 20, 2025' },
      { requirement: 'TJC FPPE summary note', owner: 'Cath Lab Medical Director', dueBy: 'Nov 22, 2025' },
    ],
    readinessScore: 92,
    nextReview: {
      committee: 'Credentials Committee',
      due: 'Dec 02, 2025',
      reviewers: ['Linda Patel, CPCS', 'Dr. Ngozi Reed'],
    },
  }
}

function wait(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration))
}

'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardCheck, Download, FileText, Shield } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type ComplianceStatus = 'PASS' | 'WARN' | 'FAIL'

type RuleDetail = {
  id: string
  name: string
  status: ComplianceStatus
  description: string
  evidence: string
  updatedAt: string
}

type ClinicianComplianceSummary = {
  clinician: {
    name: string
    credentialId: string
    specialty: string
    facility: string
    npi: string
  }
  ncqa: RuleDetail[]
  tjc: RuleDetail[]
  overduePsv: Array<{ source: string; daysOverdue: number; action: string }>
  missingEvidence: Array<{ requirement: string; owner: string; dueBy: string }>
  readinessScore: number
  nextReview: {
    committee: string
    due: string
    reviewers: string[]
  }
}

export default function ClinicianComplianceSummaryPage() {
  const summary = useMemo(() => buildMockSummary(), [])
  const [srMessage, setSrMessage] = useState('')

  const handleDownload = async (mode: 'ncqa' | 'tjc') => {
    const label = mode === 'ncqa' ? 'NCQA packet' : 'TJC packet'
    setSrMessage(`Preparing ${label} for ${summary.clinician.name}`)
    await wait(900)
    setSrMessage(`${label} ready with current evidence`)
    setTimeout(() => setSrMessage(''), 2600)
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Clinician • Compliance</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" aria-hidden="true" />
              Clinician Compliance Summary
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              NCQA CR1-CR5 and Joint Commission readiness for {summary.clinician.name}. Outstanding PSV or evidence gaps are listed with owners and due dates.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleDownload('ncqa')}>
              <FileText className="h-4 w-4" aria-hidden="true" />
              Download NCQA packet
            </Button>
            <Button onClick={() => handleDownload('tjc')}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Download TJC packet
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Snapshot metrics">
        <MetricCard title="Readiness score" value={`${summary.readinessScore}%`} description="Automated compliance grade" icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />} />
        <MetricCard title="Overdue PSV" value={`${summary.overduePsv.length}`} description="Items older than 150 days" tone="warn" icon={<CalendarClock className="h-5 w-5 text-amber-500" aria-hidden="true" />} />
        <MetricCard title="Missing evidence" value={`${summary.missingEvidence.length}`} description="CR4/CR5 documents" tone={summary.missingEvidence.length ? 'warn' : undefined} icon={<ClipboardCheck className="h-5 w-5 text-primary" aria-hidden="true" />} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Clinician profile</CardTitle>
          <CardDescription>Identifiers synced with committee packet.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {[
            { label: 'Name', value: summary.clinician.name },
            { label: 'Credential ID', value: summary.clinician.credentialId },
            { label: 'Specialty', value: summary.clinician.specialty },
            { label: 'Facility', value: summary.clinician.facility },
            { label: 'NPI', value: summary.clinician.npi },
            { label: 'Next committee review', value: `${summary.nextReview.committee} (${summary.nextReview.due})` },
          ].map((item) => (
            <div key={item.label} className="rounded-md border bg-muted/30 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className="font-semibold">{item.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <ComplianceTable title="NCQA CR1-CR5" description="Automated checks mapped to CR elements." rules={summary.ncqa} />
        <ComplianceTable title="Joint Commission readiness" description="Focus on MS.08.01.03 FPPE / OPPE review items." rules={summary.tjc} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overdue PSV</CardTitle>
            <CardDescription>Primary source verifications older than 150 days.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.overduePsv.map((item) => (
              <div key={item.source} className="rounded-md border px-3 py-2">
                <p className="font-medium">{item.source}</p>
                <p className="text-sm text-muted-foreground">
                  {item.daysOverdue} days overdue • {item.action}
                </p>
              </div>
            ))}
            {summary.overduePsv.length === 0 && <p className="text-sm text-muted-foreground">All PSV items current.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Missing evidence</CardTitle>
            <CardDescription>Documentation blockers tied to CR or TJC clauses.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.missingEvidence.map((gap) => (
              <div key={gap.requirement} className="rounded-md border px-3 py-2">
                <p className="font-medium">{gap.requirement}</p>
                <p className="text-sm text-muted-foreground">
                  Owner {gap.owner} • Due {gap.dueBy}
                </p>
              </div>
            ))}
            {summary.missingEvidence.length === 0 && <p className="text-sm text-muted-foreground">No open evidence tasks.</p>}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Next committee touchpoint</CardTitle>
          <CardDescription>Automatically mirrors committee packet timeline so compliance teams stay aligned.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Committee: <span className="font-semibold text-foreground">{summary.nextReview.committee}</span>
          </p>
          <p>Due: {summary.nextReview.due}</p>
          <p>Reviewers: {summary.nextReview.reviewers.join(', ')}</p>
        </CardContent>
      </Card>

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </div>
  )
}

function ComplianceTable({ title, description, rules }: { title: string; description: string; rules: RuleDetail[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requirement</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Evidence</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>
                  <p className="font-medium">{rule.name}</p>
                  <p className="text-sm text-muted-foreground">{rule.description}</p>
                </TableCell>
                <TableCell>
                  <StatusBadge status={rule.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{rule.evidence}</TableCell>
                <TableCell>{rule.updatedAt}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: ComplianceStatus }) {
  if (status === 'FAIL') {
    return (
      <Badge variant="destructive" className="gap-2">
        <Shield className="h-3.5 w-3.5" aria-hidden="true" />
        Fail
      </Badge>
    )
  }
  if (status === 'WARN') {
    return (
      <Badge variant="outline" className="gap-2 border-amber-300 text-amber-900">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        Warn
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-2">
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
      Pass
    </Badge>
  )
}

function MetricCard({ title, value, description, icon, tone }: { title: string; value: string; description: string; icon: ReactNode; tone?: 'warn' }) {
  return (
    <Card className={tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}>
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

function buildMockSummary(): ClinicianComplianceSummary {
  return {
    clinician: {
      name: 'Dr. Maya Lennox',
      credentialId: 'ORG-CC-9845',
      specialty: 'Interventional Cardiology',
      facility: 'Northwind Medical Center',
      npi: '1750392145',
    },
    ncqa: [
      {
        id: 'CR1.A',
        name: 'CR1.A • PSV window',
        status: 'PASS',
        description: 'Primary source verification within 180 days of committee approval.',
        evidence: 'PSV bundle anchored Oct 29',
        updatedAt: 'Nov 15, 2025',
      },
      {
        id: 'CR2.A',
        name: 'CR2.A • Recredentialing cycle',
        status: 'PASS',
        description: '36-month cycle with reminders and escalation.',
        evidence: 'Workflow auto-scheduled for 2026-03',
        updatedAt: 'Nov 13, 2025',
      },
      {
        id: 'CR3.A',
        name: 'CR3.A • Practitioner rights',
        status: 'WARN',
        description: 'Rights letter acknowledgement pending upload.',
        evidence: 'Awaiting signed acknowledgement',
        updatedAt: 'Nov 10, 2025',
      },
      {
        id: 'CR4.B',
        name: 'CR4.B • Credential file completeness',
        status: 'PASS',
        description: 'File audit checklist at 100%.',
        evidence: 'Audit sample uploaded',
        updatedAt: 'Nov 12, 2025',
      },
      {
        id: 'CR5.A',
        name: 'CR5.A • OPPE data present',
        status: 'WARN',
        description: 'OPPE dashboard flagged sedation checklist gap.',
        evidence: 'OPPE trend attached; investigation open',
        updatedAt: 'Nov 14, 2025',
      },
    ],
    tjc: [
      {
        id: 'MS.08.01.03',
        name: 'MS.08.01.03 FPPE',
        status: 'WARN',
        description: 'Focused review still pending imaging sign-off.',
        evidence: 'FPPE tracker assigned to imaging lead',
        updatedAt: 'Nov 15, 2025',
      },
      {
        id: 'MS.08.01.01',
        name: 'MS.08.01.01 OPPE',
        status: 'PASS',
        description: 'Ongoing professional practice evaluation complete.',
        evidence: 'OPPE summary exported Nov 12',
        updatedAt: 'Nov 12, 2025',
      },
    ],
    overduePsv: [
      { source: 'Anthem payer audit', daysOverdue: 17, action: 'Upload robotics case narrative' },
    ],
    missingEvidence: [
      { requirement: 'CR3 practitioner rights acknowledgement', owner: 'Credentialing analyst', dueBy: 'Nov 20, 2025' },
      { requirement: 'TJC FPPE summary note', owner: 'Cath Lab Medical Director', dueBy: 'Nov 22, 2025' },
    ],
    readinessScore: 92,
    nextReview: {
      committee: 'Credentials Committee',
      due: 'Dec 02, 2025',
      reviewers: ['Linda Patel, CPCS', 'Dr. Ngozi Reed'],
    },
  }
}

function wait(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration))
}


