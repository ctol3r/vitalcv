'use client'

import { useMemo, useState } from 'react'
import { Download, FileText, Info, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type RenewalImpact = {
  renewalId: string
  clinicianName: string
  privilegeGroup: string
  oppeScore: number
  recommendation: 'renew' | 'conditional' | 'review'
  summary: string
  factors: Array<{ label: string; detail: string; weight: number; status: 'positive' | 'neutral' | 'negative' }>
  actions: string[]
}

export default function OppeImpactPage({ params }: { params: { id: string } }) {
  const [downloading, setDownloading] = useState(false)
  const impact = useMemo(() => buildMockImpact(params.id), [params.id])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const blob = await createOppeImpactPdf(impact)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `oppe-impact-${impact.renewalId}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download failed', error)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">Demo • Privileges • Renewal #{impact.renewalId}</p>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-7 w-7 text-primary" aria-hidden="true" />
          OPPE impact on renewal
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          See how OPPE scoring and recent events influenced the recommendation for {impact.clinicianName}. Download the PDF to share with medical staff leadership.
        </p>
        <div className="flex flex-wrap gap-3" aria-live="polite">
          <Button onClick={handleDownload} disabled={downloading}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            {downloading ? 'Generating PDF…' : 'Download OPPE impact PDF'}
          </Button>
          <Badge variant="secondary" className="uppercase tracking-wide">
            {impact.recommendation}
          </Badge>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>What OPPE surfaced for this renewal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <span>
                <strong>Clinician:</strong> {impact.clinicianName}
              </span>
              <span>
                <strong>Privilege group:</strong> {impact.privilegeGroup}
              </span>
              <span>
                <strong>OPPE score:</strong> {impact.oppeScore}
              </span>
            </div>
            <p className="text-muted-foreground">{impact.summary}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Decision</CardTitle>
            <CardDescription>Automated from OPPE + policy rules.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="font-semibold">
                Recommendation: {impact.recommendation === 'renew' ? 'Full renewal' : impact.recommendation === 'conditional' ? 'Conditional renewal' : 'Escalate to MEC'}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">Automated rationale considers OPPE score, peer events, and any flags tied to this privilege group.</p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
              {impact.actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2" aria-label="OPPE factors">
        <Card>
          <CardHeader>
            <CardTitle>Contributing factors</CardTitle>
            <CardDescription>OPPE signals mapped to your policy weights.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {impact.factors.map((factor) => (
              <div key={factor.label} className="rounded-md border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{factor.label}</p>
                  <Badge variant={factor.status === 'negative' ? 'destructive' : factor.status === 'positive' ? 'default' : 'secondary'}>
                    {factor.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{factor.detail}</p>
                <p className="text-xs text-muted-foreground">Weight: {factor.weight}%</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>OPPE & Privilege policy alignment</CardTitle>
            <CardDescription>Explain this view to reviewers or board members.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>The OPPE score feeds directly into your renewal scoring rubric. A score under 85 triggers the conditional pathway with remediation tasks.</p>
            <p>
              This renewal also considers <strong>event-driven</strong> adjustments, such as complication spikes or incomplete peer reviews. All logic is surfaced here so reviewers can audit
              decisions without leaving the page.
            </p>
            <div className="flex gap-3 rounded-md border px-4 py-3">
              <Info className="h-5 w-5 text-primary" aria-hidden="true" />
              <div>
                <p className="font-semibold text-foreground">Downloadable PDF</p>
                <p>Use the export to satisfy bylaws that require OPPE documentation alongside privilege decisions.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function buildMockImpact(id: string): RenewalImpact {
  return {
    renewalId: id,
    clinicianName: 'Dr. Jamie Patel',
    privilegeGroup: 'Cardiology – Interventional',
    oppeScore: 88,
    recommendation: 'conditional',
    summary:
      'Two warning-level events reduced the composite score below the automatic renewal threshold. Remediation is required but privileges remain active with monitoring.',
    factors: [
      { label: 'Procedure volume', detail: 'Exceeded minimum threshold (115 cases in cycle)', weight: 30, status: 'positive' },
      { label: 'Complication trend', detail: 'Slight increase vs prior cycle (1.8% vs 1.2%)', weight: 25, status: 'negative' },
      { label: 'Peer review', detail: 'One pending review for contrast overuse case', weight: 20, status: 'negative' },
      { label: 'Patient satisfaction', detail: 'Press-Ganey percentile 78 (meets target)', weight: 15, status: 'positive' },
      { label: 'Documentation completeness', detail: 'Auto score 94% on dictations', weight: 10, status: 'neutral' },
    ],
    actions: ['Assign focused review for contrast usage', 'Require acknowledgement of OPPE summary', 'Re-run OPPE in 90 days'],
  }
}

async function createOppeImpactPdf(impact: RenewalImpact) {
  const lines = [
    `OPPE Impact Report – Renewal ${impact.renewalId}`,
    `Clinician: ${impact.clinicianName}`,
    `Privilege group: ${impact.privilegeGroup}`,
    `OPPE score: ${impact.oppeScore}`,
    `Recommendation: ${impact.recommendation}`,
    '',
    'Factors:',
    ...impact.factors.map((factor) => `- ${factor.label}: ${factor.detail} (${factor.status})`),
  ]
  const pdfString = buildSimplePdf(lines)
  return new Blob([pdfString], { type: 'application/pdf' })
}

function buildSimplePdf(lines: string[]) {
  const escapePdf = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  let stream = 'BT\n/F1 12 Tf\n72 760 Td\n'
  lines.forEach((line, index) => {
    if (index === 0) {
      stream += `(${escapePdf(line)}) Tj\n`
    } else {
      stream += `0 -16 Td\n(${escapePdf(line)}) Tj\n`
    }
  })
  stream += 'ET\n'
  const objects: Array<{ id: number; body: string }> = [
    { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
    { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    {
      id: 3,
      body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    },
    {
      id: 4,
      body: `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    },
    { id: 5, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' },
  ]
  let pdf = '%PDF-1.3\n'
  const offsets: number[] = [0]
  objects.forEach((object) => {
    offsets[object.id] = pdf.length
    pdf += `${object.id} 0 obj\n${object.body}\nendobj\n`
  })
  const xrefStart = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return pdf
}

