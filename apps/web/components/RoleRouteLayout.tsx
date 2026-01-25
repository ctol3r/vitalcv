import Link from 'next/link';

import { Button } from '@/components/ui/button';
import type { RoleRouteToken } from './roleTokens';

type RoleRouteLayoutProps = {
  token: RoleRouteToken;
};

export function RoleRouteLayout({ token }: RoleRouteLayoutProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-6 py-12 md:py-16">
        <div className="max-w-4xl space-y-12">
          <section className="space-y-6">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {token.role}
              </p>
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                {token.headline}
              </h1>
              <p className="text-lg text-muted-foreground md:text-xl">{token.subhead}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <h2 className="text-2xl font-semibold md:text-3xl">Purpose</h2>
              <p className="mt-4 text-base md:text-lg">{token.purpose}</p>
              <p className="mt-3 text-sm text-muted-foreground">{token.purposePlaceholder}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold md:text-3xl">Core Signals</h2>
              <p className="text-base md:text-lg">{token.coreSignalsIntro}</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {token.coreSignals.map((signal) => (
                  <li
                    key={signal}
                    className="rounded-lg border border-border/60 bg-background px-3 py-2"
                  >
                    {signal}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold md:text-3xl">Primary Action</h2>
              <p className="text-base md:text-lg">{token.primaryAction}</p>
              <p className="text-sm text-muted-foreground">{token.primaryActionPlaceholder}</p>
              <Button asChild size="lg" className="mt-2 w-full sm:w-auto">
                <Link href={token.ctaHref}>{token.ctaLabel}</Link>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
