'use client';

/**
 * StatsSection — count-up statistics bar for marketing pages.
 */

import { CountUpStat } from '@/components/ui/count-up-stat';
import { ScrollSection, ScrollItem } from '@/components/motion/ScrollSection';

export function StatsSection() {
  return (
    <section className="border-t border-[var(--vt-border)] px-6 py-16 bg-[var(--vt-surface-subtle)]">
      <ScrollSection className="mx-auto max-w-5xl">
        <ScrollItem>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <CountUpStat
              value={6.8}
              suffix="M"
              decimals={1}
              label="licensed US healthcare workers"
            />
            <CountUpStat
              value={9}
              prefix="$"
              suffix="K"
              label="lost per day per unfilled slot"
            />
            <CountUpStat
              value={10}
              prefix="~"
              suffix="s"
              label="to first readiness snapshot"
            />
            <CountUpStat
              value={4.2}
              prefix="$"
              suffix="B"
              decimals={1}
              label="US credentialing market"
            />
          </div>
        </ScrollItem>
      </ScrollSection>
    </section>
  );
}
