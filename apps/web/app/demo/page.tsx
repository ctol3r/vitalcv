import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import { MarketingShell } from '@/components/marketing/MarketingShell'
import { ParticlesCanvas } from '@/components/marketing/ParticlesCanvas'
import { Badge } from '@/components/ui/badge'

export default function DemoPage() {
  return (
    <MarketingShell>
      <section className="relative overflow-hidden">
        <ParticlesCanvas className="opacity-50" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-12 pt-16">
          <Badge
            variant="outline"
            className="rounded-full border-border/70 px-4 py-1 text-[0.6rem] uppercase tracking-[0.4em] text-muted-foreground"
          >
            Demo
          </Badge>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Explore VitalCV demos.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Focused, single-action demos that show how PSV evidence becomes a decisive signal.
          </p>
        </div>
      </section>

      <section className="border-t border-border/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <Link
            href="/demo/psv"
            className="group block rounded-2xl border border-border/70 bg-card/70 p-8 shadow-sm transition hover:border-foreground/30"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Primary Source Verification
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-foreground">PSV Report Builder</h2>
                <p className="mt-3 max-w-xl text-sm text-muted-foreground">
                  Run a PSV check, review source-level evidence, and see the resulting policy
                  decision in one screen.
                </p>
              </div>
              <ArrowUpRight className="h-6 w-6 text-muted-foreground transition group-hover:text-foreground" />
            </div>
          </Link>
        </div>
      </section>
    </MarketingShell>
  )
}
