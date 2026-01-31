import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import { ArchGrid } from '@/components/marketing/ArchGrid'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { ParticlesCanvas } from '@/components/marketing/ParticlesCanvas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function ClinicianPage() {
  return (
    <MarketingShell>
      <section className="relative overflow-hidden">
        <ParticlesCanvas className="opacity-50" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-16 pt-16">
          <Badge
            variant="outline"
            className="rounded-full border-border/70 px-4 py-1 text-[0.6rem] uppercase tracking-[0.4em] text-muted-foreground"
          >
            Clinician
          </Badge>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Verify once. Carry authority everywhere.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            VitalCV anchors your primary source verification evidence so employers can trust your
            credentials without repeated checks or redundant requests.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full px-6">
              <Link href="/onboarding">
                Start recognition
                <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-6">
              <Link href="/demo/psv">Run PSV demo</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t border-border/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['Identity anchored', 'NPI and taxonomy verified against authoritative registries.'],
              ['Exclusions cleared', 'OIG, SAM, and CMS checks logged with evidence trails.'],
              ['Shareable proof', 'A single recognition link for every credentialing request.'],
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
              Built for trust
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
              PSV evidence stays in your control.
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              VitalCV keeps every check timestamped, expirable, and tied to an audit-ready evidence
              reference so you never have to restate the same proof.
            </p>
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}
