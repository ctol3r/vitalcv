import type { ReactNode } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '/clinician', label: 'Clinician' },
  { href: '/employer', label: 'Employer' },
  { href: '/issuer', label: 'Issuer' },
  { href: '/demo', label: 'Demo' },
]

type MarketingShellProps = {
  children: ReactNode
  className?: string
  mainClassName?: string
  ctaLabel?: string
  ctaHref?: string
}

export function MarketingShell({
  children,
  className,
  mainClassName,
  ctaLabel = 'Run PSV Demo',
  ctaHref = '/demo/psv',
}: MarketingShellProps) {
  return (
    <div className={cn('min-h-screen bg-background text-foreground', className)}>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-foreground"
          >
            <span className="h-2 w-2 rounded-full bg-primary" />
            VitalCV
          </Link>
          <nav className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground md:flex">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </nav>
          <Button asChild size="sm" className="rounded-full px-4 text-xs uppercase tracking-[0.2em]">
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        </div>
      </header>

      <main className={cn('relative', mainClassName)}>{children}</main>

      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 text-xs uppercase tracking-[0.2em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Antigravity Contract: Active</span>
          <span>Evidence-first PSV</span>
        </div>
      </footer>
    </div>
  )
}
