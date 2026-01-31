import Link from 'next/link'
import { ArrowUpRight, ShieldCheck } from 'lucide-react'

import { ArchGrid } from '@/components/marketing/ArchGrid'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { ParticlesCanvas } from '@/components/marketing/ParticlesCanvas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function HomePage() {
  return (
    <MarketingShell>
      <section className="relative overflow-hidden">
        <ParticlesCanvas className="opacity-60" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-20">
          <div className="grid items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <Badge
                variant="outline"
                className="rounded-full border-border/70 px-4 py-1 text-[0.6rem] uppercase tracking-[0.4em] text-muted-foreground"
              >
                Antigravity PSV
              </Badge>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Credentialing without friction.
              </h1>
              <p className="mt-5 text-lg text-muted-foreground">
                VitalCV runs evidence-first primary source verification with audit-grade trails and
                policy decisions that stay portable for clinicians and employers.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-full px-6">
                  <Link href="/demo/psv">
                    Run PSV demo
                    <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full px-6">
                  <Link href="/clinician">For clinicians</Link>
                </Button>
              </div>
              <div className="mt-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Minimal surface. Maximum proof.
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-6 rounded-[32px] bg-primary/10 blur-3xl" />
              <Card className="relative overflow-hidden border-border/60 bg-card/80 shadow-xl backdrop-blur animate-[float_12s_ease-in-out_infinite]">
                <CardHeader className="border-b border-border/50">
                  <CardTitle className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    PSV Snapshot
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Decision</span>
                      <Badge
                        variant="outline"
                        className="rounded-full border-primary/20 bg-primary/10 text-primary"
                      >
                        Review
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Restricted sources stay gated until credentials are configured.
                    </p>
                  </div>
                  <div className="space-y-3 text-sm">
                    {[
                      ['OIG LEIE', 'PASS'],
                      ['SAM Exclusions', 'NOT CONFIGURED'],
                      ['CMS PPEF', 'PASS'],
                      ['State Board', 'RESTRICTED'],
                    ].map(([label, status]) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-foreground">{label}</span>
                        <span className="text-muted-foreground">{status}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Evidence anchored, policy-evaluated, timestamped.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-border/60 bg-secondary/20">
        <ArchGrid className="opacity-60" />
        <div className="relative mx-auto w-full max-w-6xl px-6 py-20">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Credibility without clutter
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
                PSV built for compliance teams and clinical leadership.
              </h2>
              <p className="mt-4 text-base text-muted-foreground">
                Every check produces immutable evidence, explicit expiry, and a policy decision
                that can be audited without re-running the workflow.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['Evidence anchors', 'Deterministic fingerprints and stored artifacts.'],
                ['Freshness windows', 'Explicit expiry with policy-aligned SLA.'],
                ['Decision trace', 'Clear reasons tied to each source.'],
                ['Restricted gates', 'No false positives for closed systems.'],
              ].map(([title, description]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur"
                >
                  <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['Clinicians', 'Verify once, keep authority portable.', '/clinician'],
              ['Employers', 'Audit PSV evidence in minutes.', '/employer'],
              ['Issuers', 'Attach PSV trails to credentials.', '/issuer'],
            ].map(([title, description, href]) => (
              <Link
                key={title}
                href={href}
                className="group rounded-2xl border border-border/70 bg-background p-6 transition hover:border-foreground/30"
              >
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                <span className="mt-4 inline-flex items-center text-xs uppercase tracking-[0.3em] text-muted-foreground group-hover:text-foreground">
                  Explore
                  <ArrowUpRight className="ml-2 h-3 w-3" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}
