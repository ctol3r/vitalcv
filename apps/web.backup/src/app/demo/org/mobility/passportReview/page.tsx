'use client';

import { AlertTriangle, ArrowRight, Building2, CheckCircle2, NotebookPen, PlugZap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const certifiedClaims = [
  { label: 'Privilege scope', detail: 'Independent emergency medicine at Org A' },
  { label: 'Latest OPPE cycle', detail: 'Completed Aug 2025 (score 96/100)' },
  { label: 'DEA schedules', detail: 'II – V, no restrictions' },
];

const missingPieces = [
  {
    label: 'CE attestation',
    detail: 'Org B requires 50 CME hours / 24 months',
    severity: 'warning',
  },
  {
    label: 'Peer references',
    detail: 'Need 2 cross-org references — none bundled in passport',
    severity: 'warning',
  },
  {
    label: 'Payer enrollment sync',
    detail: 'MobilityEngine suggests verifying BCBS + Optum entries',
    severity: 'info',
  },
];

const mobilitySignals = [
  {
    label: 'Mobility score',
    detail: '92 / 100 (Org A trust + national license coverage)',
    severity: 'success',
  },
  {
    label: 'Telehealth readiness',
    detail: 'Org A passport certifies telehealth kit completion',
    severity: 'success',
  },
  {
    label: 'Gaps to clear',
    detail: 'Upload CE proof + payer roster to unlock Auto-Onboard',
    severity: 'warning',
  },
];

export default function CrossOrgPassportReviewPage() {
  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary" className="gap-1">
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            Org B reviewer
          </Badge>
          <Badge variant="outline">MobilityEngine linked</Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Cross-org passport review</h1>
        <p className="text-muted-foreground">
          Org B sees what Org A&apos;s passport certifies in real time. Missing artifacts are flagged and
          MobilityEngine signals drive what to request next.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
            <span>Org A — Northstar Health</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            <span>Org B — Cascade Mobility Network</span>
          </CardTitle>
          <CardDescription>
            Passport v3 shared via NCI. Below shows what Org B receives plus MobilityEngine overlays.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <section aria-label="What Org A certifies" className="space-y-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Org A certified payload
              </p>
              <p>Ready for Org B onboarding — 7 claims disclosed, 3 hashed.</p>
            </div>
            <ul className="space-y-3">
              {certifiedClaims.map((claim) => (
                <li key={claim.label} className="rounded-lg border border-border/70 p-3">
                  <p className="text-sm font-semibold">{claim.label}</p>
                  <p className="text-sm text-muted-foreground">{claim.detail}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="What Org B still needs" className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Missing inputs
              </p>
              <p>Org B workflow blocks until these artifacts arrive.</p>
            </div>
            <ul className="space-y-3">
              {missingPieces.map((item) => (
                <li key={item.label} className="rounded-lg border border-dashed border-amber-400/70 p-3">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                </li>
              ))}
            </ul>
          </section>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlugZap className="h-4 w-4" aria-hidden="true" />
              MobilityEngine insights
            </CardTitle>
            <CardDescription>Fusion of passport telemetry + workforce rules.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mobilitySignals.map((signal) => (
              <div
                key={signal.label}
                className={`rounded-lg border border-border/70 p-3 text-sm ${
                  signal.severity === 'success'
                    ? 'bg-emerald-50 text-emerald-900'
                    : signal.severity === 'warning'
                      ? 'bg-amber-50 text-amber-900'
                      : 'bg-red-50 text-red-900'
                }`}
              >
                <p className="font-semibold">{signal.label}</p>
                <p>{signal.detail}</p>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              MobilityEngine calls Org A&apos;s packet API, Org B&apos;s policies, and NCI trust anchors to
              derive these recommendations.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <NotebookPen className="h-4 w-4" aria-hidden="true" />
              Reviewer notes
            </CardTitle>
            <CardDescription>Everything Org B logs syncs back into the Mobility timeline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              • CE proof request sent via NCI federated channel.<br />
              • Auto-provision privileges once CME + payer sync clear.<br />
              • Keep DEA disclosure hidden from vendor delegates.
            </p>
            <p className="text-xs text-muted-foreground">
              Notes stored with TimelineEvent <code>PASSPORT_SHARED</code> so both orgs see the history.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
