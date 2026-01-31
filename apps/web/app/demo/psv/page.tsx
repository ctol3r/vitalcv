import { MarketingShell } from '@/components/marketing/MarketingShell'
import { ParticlesCanvas } from '@/components/marketing/ParticlesCanvas'
import { Badge } from '@/components/ui/badge'

import PsvDemoClient from './PsvDemoClient'

export default function PsvDemoPage() {
  return (
    <MarketingShell>
      <section className="relative overflow-hidden">
        <ParticlesCanvas className="opacity-50" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-8 pt-16">
          <Badge
            variant="outline"
            className="rounded-full border-border/70 px-4 py-1 text-[0.6rem] uppercase tracking-[0.4em] text-muted-foreground"
          >
            Primary Source Verification
          </Badge>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            PSV report demo.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Run a PSV check, see each source status, and review evidence references in one screen.
          </p>
        </div>
      </section>

      <section className="border-t border-border/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-12">
          <PsvDemoClient />
        </div>
      </section>
    </MarketingShell>
  )
}
