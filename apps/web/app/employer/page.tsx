import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import { ArchGrid } from '@/components/marketing/ArchGrid'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { ParticlesCanvas } from '@/components/marketing/ParticlesCanvas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function EmployerPage() {
  return (
    <MarketingShell>
      <section className="relative overflow-hidden">
        <ParticlesCanvas className="opacity-50" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-16 pt-16">
          <Badge
            variant="outline"
            className="rounded-full border-border/70 px-4 py-1 text-[0.6rem] uppercase tracking-[0.4em] text-muted-foreground"
          >
            Employer
          </Badge>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Hire with PSV evidence already attached.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            VitalCV compresses credentialing time by surfacing primary source checks, evidence
            references, and policy decisions in a single view.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full px-6">
              <Link href="/demo/psv">
                Run PSV demo
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-6">
              <Link href="/issuer">For issuers</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t border-border/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['Decision clarity', 'CLEAR, REVIEW, or BLOCK with reasons per source.'],
              ['Audit-ready', 'Evidence references tie every check to its origin.'],
              ['Freshness aligned', 'Expiry dates and policy windows visible at a glance.'],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-2xl border border-border/70 bg-card/70 p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-border/60 bg-secondary/20">
        <ArchGrid className="opacity-60" />
        <div className="relative mx-auto w-full max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Credibility surface
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
              See every primary source without re-running checks.
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              PSV evidence stays attached to the clinician profile, so you review once and reuse
              across every role, facility, or payer workflow.
            </p>
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}
