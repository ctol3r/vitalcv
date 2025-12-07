'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, ClipboardList, Download, FileText, ShieldAlert, Sparkles, Stethoscope } from 'lucide-react'

import { AINarrativePanel, type NarrativeSection } from '@/components/committee/AINarrativePanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

type CommitteeSection = {
  id: string
  title: string
  summary: string
  status?: 'clear' | 'watch' | 'risk'
  srHint?: string
  defaultOpen?: boolean
  content: ReactNode
}

export default function OrgCommitteePacketPage({ params }: { params: { clinicianId: string } }) {
  const packet = useMemo(() => buildMockCommitteePacket(params.clinicianId), [params.clinicianId])
  const [srMessage, setSrMessage] = useState('')
  const [aiSections, setAiSections] = useState<NarrativeSection[]>(packet.aiNarrative.sections)
  const [aiUpdatedAt, setAiUpdatedAt] = useState(packet.aiNarrative.updatedAt)

  const handleDownload = async (mode: 'pdf' | 'zip') => {
    setSrMessage(`Preparing ${mode.toUpperCase()} export`)
    await wait(900)
    setSrMessage(`${mode.toUpperCase()} export ready in downloads tray`)
    setTimeout(() => setSrMessage(''), 3200)
  }

  const refreshNarrative = async () => {
    await wait(750)
    const nextTimestamp = new Date().toISOString()
    const rotated = aiSections.map((section, index) => ({
      ...section,
      summary: index === 0 ? 'AI flagged a pending payer decision but no escalations' : section.summary,
      insights: section.insights.slice().sort(() => Math.random() - 0.5),
    }))
    setAiSections(rotated)
    setAiUpdatedAt(nextTimestamp)
    return rotated
  }

  const sections = useMemo<CommitteeSection[]>(
    () => [
      {
        id: 'identity',
        title: 'Identity',
        summary: 'Primary clinician profile, verified identifiers, and credential IDs',
        status: 'clear',
        defaultOpen: true,
        content: (
          <dl className="grid gap-4 md:grid-cols-2">
            {[
              { label: 'Clinician', value: packet.clinician.name },
              { label: 'Specialty', value: packet.clinician.specialty },
              { label: 'NPI', value: packet.clinician.npi },
              { label: 'Credential ID', value: packet.clinician.credentialId },
              { label: 'Facility', value: packet.clinician.facility },
              { label: 'Primary Reviewer', value: 'Linda Patel, CPCS' },
            ].map((item) => (
              <div key={item.label} className="rounded-md border bg-muted/20 px-4 py-3">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</dt>
                <dd className="text-base font-semibold">{item.value}</dd>
              </div>
            ))}
          </dl>
        ),
      },
      {
        id: 'licensure',
        title: 'Licensure',
        summary: 'State license freshness, sanctions, and expiration horizon',
        status: 'clear',
        content: (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>State</TableHead>
                <TableHead>License #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packet.licensure.map((license) => (
                <TableRow key={license.state}>
                  <TableCell className="font-medium">{license.state}</TableCell>
                  <TableCell>{license.number}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={license.status === 'ACTIVE' ? 'border-emerald-300 text-emerald-700' : 'border-amber-300 text-amber-800'}>
                      {license.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{license.expires}</TableCell>
                  <TableCell>{license.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ),
      },
      {
        id: 'board',
        title: 'Board',
        summary: 'Board certifications with MOC status',
        status: 'clear',
        content: (
          <div className="grid gap-4 md:grid-cols-2">
            {packet.boardCertifications.map((cert) => (
              <Card key={cert.board} className="border-muted">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    {cert.board}
                    <Badge variant="outline">{cert.status}</Badge>
                  </CardTitle>
                  <CardDescription>{cert.focus}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  <p>Certified: {cert.certified}</p>
                  <p>MOC due: {cert.mocDue}</p>
                  <p>Source: {cert.source}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ),
      },
      {
        id: 'dea',
        title: 'DEA',
        summary: 'Controlled substance registrations and schedule limits',
        status: 'clear',
        content: (
          <div className="flex flex-wrap gap-3">
            <div className="rounded-lg border px-4 py-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Registration</p>
              <p className="font-semibold">{packet.dea.registration}</p>
              <p className="text-xs text-muted-foreground">Renewal {packet.dea.renewal}</p>
            </div>
            <div className="rounded-lg border px-4 py-3 flex flex-col gap-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Allowable schedules</p>
              <div className="flex gap-2 flex-wrap">
                {packet.dea.schedules.map((schedule) => (
                  <Badge key={schedule} variant="secondary">
                    Schedule {schedule}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="rounded-lg border px-4 py-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Last audit</p>
              <p className="font-semibold">{packet.dea.audit}</p>
              <p className="text-xs text-muted-foreground">No gaps detected</p>
            </div>
          </div>
        ),
      },
      {
        id: 'pecos',
        title: 'PECOS',
        summary: 'Medicare enrollment lifecycle',
        status: 'watch',
        content: (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Enrollment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Update</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packet.pecos.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.enrollment}</TableCell>
                  <TableCell>
                    <Badge variant={entry.status === 'APPROVED' ? 'secondary' : 'outline'} className={entry.status === 'PENDING' ? 'border-amber-300 text-amber-900' : undefined}>
                      {entry.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{entry.updated}</TableCell>
                  <TableCell className="text-muted-foreground">{entry.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ),
      },
      {
        id: 'medicaid',
        title: 'Medicaid',
        summary: 'State Medicaid participation snapshot',
        status: 'clear',
        content: (
          <div className="space-y-3">
            {packet.medicaid.map((medicaid) => (
              <div key={medicaid.state} className="flex items-center justify-between rounded-md border px-4 py-3">
                <div>
                  <p className="font-medium">{medicaid.state} Medicaid</p>
                  <p className="text-sm text-muted-foreground">{medicaid.note}</p>
                </div>
                <Badge variant={medicaid.status === 'ACTIVE' ? 'secondary' : 'outline'}>{medicaid.status}</Badge>
              </div>
            ))}
          </div>
        ),
      },
      {
        id: 'payers',
        title: 'Payers',
        summary: 'Commercial payer decisions and CLN links',
        status: 'watch',
        content: (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead>Contacts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packet.payerPanels.map((panel) => (
                <TableRow key={panel.payer}>
                  <TableCell className="font-medium">{panel.payer}</TableCell>
                  <TableCell>
                    <Badge variant={panel.status === 'APPROVED' ? 'secondary' : 'outline'} className={panel.status === 'PENDING' ? 'border-amber-300 text-amber-900' : undefined}>
                      {panel.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{panel.effective}</TableCell>
                  <TableCell className="text-muted-foreground">{panel.contact}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ),
      },
      {
        id: 'privileges',
        title: 'Privileges',
        summary: 'Facility-level grants and FPPE dependencies',
        status: 'clear',
        content: (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service line</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Last Renewed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packet.privileges.map((privilege) => (
                <TableRow key={privilege.scope}>
                  <TableCell className="font-medium">{privilege.serviceLine}</TableCell>
                  <TableCell>{privilege.scope}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-emerald-300 text-emerald-900">
                      {privilege.level}
                    </Badge>
                  </TableCell>
                  <TableCell>{privilege.renewed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ),
      },
      {
        id: 'fppe',
        title: 'FPPE',
        summary: 'Focused review plans and outstanding verifications',
        status: 'watch',
        content: (
          <div className="grid gap-4 md:grid-cols-2">
            {packet.fppe.map((plan) => (
              <Card key={plan.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{plan.title}</CardTitle>
                  <CardDescription>{plan.focus}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>Due {plan.due}</p>
                  <p>{plan.owner}</p>
                  <Badge variant="outline" className={plan.status === 'OPEN' ? 'border-amber-300 text-amber-900' : undefined}>
                    {plan.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        ),
      },
      {
        id: 'oppe',
        title: 'OPPE',
        summary: 'Operational metrics, peer comparisons, and triggers',
        status: 'clear',
        content: (
          <div className="grid gap-4 md:grid-cols-3">
            {packet.oppe.metrics.map((metric) => (
              <div key={metric.label} className="rounded-lg border px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                <p className="text-2xl font-semibold">{metric.value}</p>
                <p className="text-xs text-muted-foreground">{metric.detail}</p>
              </div>
            ))}
            <div className="md:col-span-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              {packet.oppe.note}
            </div>
          </div>
        ),
      },
      {
        id: 'timeline',
        title: 'Timeline',
        summary: 'Latest milestones, escalation taps, and committee holds',
        status: 'clear',
        content: (
          <ol className="space-y-4">
            {packet.timeline.map((event) => (
              <li key={event.id} className="flex gap-4">
                <div className={cn('mt-1 h-3 w-3 rounded-full border-2', event.tone === 'warning' ? 'border-amber-500' : event.tone === 'risk' ? 'border-rose-500' : 'border-emerald-500')} aria-hidden="true" />
                <div>
                  <p className="font-semibold">
                    {event.title}
                    <span className="text-sm text-muted-foreground"> • {event.when}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">{event.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        ),
      },
      {
        id: 'risk',
        title: 'Risk',
        summary: 'Credentialing exposure and readiness score',
        status: 'risk',
        content: (
          <div className="grid gap-4 md:grid-cols-2">
            {packet.risks.map((risk) => (
              <Card key={risk.id} className="border-rose-100 bg-rose-50/60 dark:bg-rose-950/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{risk.title}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-rose-600">
                    <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                    Severity {risk.severity}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>{risk.summary}</p>
                  <p className="font-medium text-foreground">Owner: {risk.owner}</p>
                  <p>Next action: {risk.nextAction}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ),
      },
      {
        id: 'ai-summary',
        title: 'AI Summary',
        summary: 'Narrative briefing for the credentialing committee',
        status: 'watch',
        content: <AINarrativePanel sections={aiSections} updatedAt={aiUpdatedAt} onRefresh={refreshNarrative} headline="AI summary for committee" />,
      },
    ],
    [packet, aiSections, aiUpdatedAt],
  )

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Org • Committee Packet</p>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Stethoscope className="h-8 w-8 text-primary" aria-hidden="true" />
              Committee Packet Viewer
            </h1>
            <p className="max-w-2xl text-muted-foreground">
              Screen-reader optimized accordion with SR hints for each section. Export authoritative packets or launch the submit workflow without leaving this view.
            </p>
            <div className="flex flex-wrap gap-2" aria-label="Packet readiness signals">
              {packet.statusIndicators.map((indicator) => (
                <Badge key={indicator.label} variant={indicator.variant} className="gap-2">
                  {indicator.icon}
                  {indicator.label}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleDownload('pdf')}>
              <FileText className="h-4 w-4" aria-hidden="true" />
              Export PDF
            </Button>
            <Button variant="outline" onClick={() => handleDownload('zip')}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Download ZIP
            </Button>
            <Button asChild>
              <Link href={`/demo/org/committee/${params.clinicianId}/submit`} className="flex items-center gap-2">
                Submit to committee
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3" aria-label="At-a-glance metrics">
        {packet.highlights.map((highlight) => (
          <Card key={highlight.label} className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                {highlight.icon}
                {highlight.label}
              </CardTitle>
              <CardDescription>{highlight.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{highlight.value}</CardContent>
          </Card>
        ))}
      </section>

      <main className="space-y-4" role="region" aria-label="Committee packet details">
        {sections.map((section) => (
          <CommitteeAccordionSection key={section.id} {...section} />
        ))}
      </main>

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </div>
  )
}

function CommitteeAccordionSection({ id, title, summary, status, content, defaultOpen = false }: CommitteeSection) {
  const badge = status ? <SectionBadge status={status} /> : null
  return (
    <details className="group rounded-xl border bg-background shadow-sm transition focus-within:ring-2 focus-within:ring-ring" open={defaultOpen}>
      <summary
        className="flex cursor-pointer flex-col gap-2 px-5 py-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:flex-row md:items-center md:justify-between"
        role="button"
        aria-controls={`${id}-content`}
      >
        <div>
          <p className="font-semibold text-lg">{title}</p>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </div>
        {badge}
      </summary>
      <div id={`${id}-content`} className="border-t px-5 py-4">{content}</div>
    </details>
  )
}

function SectionBadge({ status }: { status: NonNullable<CommitteeSection['status']> }) {
  if (status === 'clear') {
    return (
      <Badge variant="secondary" className="gap-2 text-xs">
        <Sparkles className="h-4 w-4 text-emerald-500" aria-hidden="true" />
        Ready
      </Badge>
    )
  }
  if (status === 'watch') {
    return (
      <Badge variant="outline" className="gap-2 border-amber-300 text-amber-900">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        Watch
      </Badge>
    )
  }
  return (
    <Badge variant="destructive" className="gap-2">
      <ShieldAlert className="h-4 w-4" aria-hidden="true" />
      Risk
    </Badge>
  )
}

function buildMockCommitteePacket(clinicianId: string) {
  const now = new Date()
  const lastWeek = new Date(now)
  lastWeek.setDate(now.getDate() - 7)

  const aiSections: NarrativeSection[] = [
    {
      id: 'quality',
      title: 'Quality + throughput',
      summary: 'Case mix index stable, zero mortality outliers',
      insights: ['OPPE percentile stayed in the 78th percentile vs peers.', 'No safety events in the past 120 days per sentinel feed.', 'Volume up 6% month-over-month with manageable readmissions.'],
      sentiment: 'positive',
      recommendation: 'Proceed with automatic renewal of core privileges.',
    },
    {
      id: 'payer',
      title: 'Payer grid',
      summary: 'Anthem pending after request for additional surgical logs',
      insights: ['AI detected payer questions referencing robotic case documentation.', 'Humana and Aetna validated after EMR evidence sync.', 'Recommend uploading robotic case peer attestations to reduce iterations.'],
      sentiment: 'warning',
      recommendation: 'Share OR governance note with payer reps before next call.',
    },
    {
      id: 'compliance',
      title: 'Compliance posture',
      summary: 'Zero sanctions, PECOS lifecycle refreshed this week',
      insights: ['No OIG hits or SAM.gov exclusions found.', 'PECOS revalidation due within 90 days; auto reminder scheduled.', 'Medicaid CA enrollment requires final CFO signature.'],
      sentiment: 'neutral',
    },
  ]

  return {
    clinicianId,
    clinician: {
      name: 'Dr. Maya Lennox',
      specialty: 'Interventional Cardiology',
      npi: '1750392145',
      credentialId: 'ORG-CC-9845',
      facility: 'Northwind Medical Center',
    },
    statusIndicators: [
      { label: 'Packet draft synced 2h ago', variant: 'outline' as const, icon: <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> },
      { label: 'FPPE pending imaging sign-off', variant: 'secondary' as const, icon: <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" /> },
      { label: 'Risk score 2.1 / 5', variant: 'secondary' as const, icon: <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> },
    ],
    highlights: [
      { label: 'Licensure freshness', value: '100%', description: '4 states verified < 48h', icon: <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" /> },
      { label: 'Payer approvals', value: '6 / 7', description: 'One payer pending docs', icon: <FileText className="h-4 w-4 text-primary" aria-hidden="true" /> },
      { label: 'Risk posture', value: 'Low', description: 'No sanctions or hits', icon: <ShieldAlert className="h-4 w-4 text-primary" aria-hidden="true" /> },
    ],
    licensure: [
      { state: 'CA', number: 'A12345', status: 'ACTIVE', expires: 'Nov 12, 2026', source: 'Breeze API' },
      { state: 'OR', number: 'MD-77410', status: 'ACTIVE', expires: 'Apr 9, 2027', source: 'Automated PSV' },
      { state: 'WA', number: 'MD61034', status: 'ACTIVE', expires: 'Jan 18, 2026', source: 'DirectConnect' },
    ],
    boardCertifications: [
      { board: 'ABIM', focus: 'Interventional Cardiology', status: 'GOOD STANDING', certified: 'Oct 2018', mocDue: 'Oct 2026', source: 'ABIM API' },
      { board: 'ABIM', focus: 'Internal Medicine', status: 'GOOD STANDING', certified: 'Jun 2015', mocDue: 'Jun 2025', source: 'ABIM API' },
    ],
    dea: {
      registration: 'FL1234561',
      renewal: 'Mar 2027',
      audit: 'Jun 2024',
      schedules: ['II', 'III', 'IV'],
    },
    pecos: [
      { id: '1', enrollment: 'Medicare Part B', status: 'APPROVED', updated: lastWeek.toLocaleDateString(), note: 'No action required' },
      { id: '2', enrollment: 'Revalidation', status: 'PENDING', updated: now.toLocaleDateString(), note: 'CMS requested robotic case log' },
    ],
    medicaid: [
      { state: 'California', status: 'ACTIVE', note: 'Renewed via CalAIM feed' },
      { state: 'Oregon', status: 'ACTIVE', note: 'Auto-synced with OR MMIS' },
    ],
    payerPanels: [
      { payer: 'Anthem CA', status: 'PENDING', effective: '—', contact: 'kelly.certs@anthem.com' },
      { payer: 'Aetna National', status: 'APPROVED', effective: 'Sep 1, 2024', contact: 'aetna-clinical@aetna.com' },
      { payer: 'Humana', status: 'APPROVED', effective: 'Oct 12, 2024', contact: 'humana-grid@humana.com' },
    ],
    privileges: [
      { serviceLine: 'Cath Lab', scope: 'PCI + structural', level: 'FULL', renewed: 'Aug 2, 2024' },
      { serviceLine: 'Telehealth', scope: 'Virtual cardiac consults', level: 'FULL', renewed: 'May 12, 2024' },
    ],
    fppe: [
      { id: 'fppe-1', title: 'Imaging peer review', focus: '3 random cath cases', due: 'Nov 30', owner: 'Chief of Cardiology', status: 'OPEN' },
      { id: 'fppe-2', title: 'Sedation checklist audit', focus: 'Complete doc review', due: 'Dec 14', owner: 'MSO', status: 'PLANNED' },
    ],
    oppe: {
      metrics: [
        { label: 'Peer percentile', value: '78th', detail: 'Cardiology cohort' },
        { label: 'Complication rate', value: '1.9%', detail: 'Target 2.4%' },
        { label: 'Case volume', value: '612', detail: 'Rolling 12 months' },
      ],
      note: 'OPPE trending positive — top decile for throughput, zero sentinel events flagged.',
    },
    timeline: [
      { id: 't1', title: 'Packet refreshed', when: '2h ago', detail: 'Risk + evidence synced', tone: 'positive' },
      { id: 't2', title: 'Payer request', when: 'Yesterday', detail: 'Anthem asked for robotics log', tone: 'warning' },
      { id: 't3', title: 'FPPE review launched', when: '4 days ago', detail: 'Cath lab imaging sample assigned', tone: 'positive' },
    ],
    risks: [
      { id: 'r1', title: 'Payer documentation loop', summary: 'Anthem needs robotic console logs to finish panel decision.', owner: 'Network Ops', severity: 'Medium', nextAction: 'Upload OR documentation by Friday.' },
      { id: 'r2', title: 'FPPE dependency', summary: 'Focused review still waiting for imaging sign-offs.', owner: 'MSO', severity: 'Medium', nextAction: 'Escalate to Imaging Medical Director.' },
    ],
    aiNarrative: {
      updatedAt: now.toISOString(),
      sections: aiSections,
    },
  }
}

function wait(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration))
}


