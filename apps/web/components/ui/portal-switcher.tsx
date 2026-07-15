'use client';

import { Building2, Shield, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ------------------------------------------------------------------ */
/*  Portal definitions                                                 */
/* ------------------------------------------------------------------ */

const PORTALS = [
  {
    key: 'clinician',
    label: 'Clinician',
    href: '/holder',
    icon: Stethoscope,
    description: 'Credential wallet',
  },
  {
    key: 'employer',
    label: 'Employer',
    href: '/employer/dashboard',
    icon: Shield,
    description: 'Verify & match',
  },
  {
    key: 'issuer',
    label: 'Issuer',
    href: '/issuer',
    icon: Building2,
    description: 'Issue & manage',
  },
] as const;

/* ------------------------------------------------------------------ */
/*  PortalSwitcher                                                     */
/* ------------------------------------------------------------------ */

export function PortalSwitcher() {
  const pathname = usePathname();

  const activeKey = PORTALS.find((p) => pathname.startsWith(p.href))?.key ?? null;

  return (
    <nav
      className="flex items-center gap-1 rounded-xl bg-muted/30 border border-[var(--glass-border)] p-1"
      aria-label="Portal navigation"
    >
      {PORTALS.map((portal) => {
        const Icon = portal.icon;
        const isActive = portal.key === activeKey;
        return (
          <Link
            key={portal.key}
            href={portal.href}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? 'bg-background shadow-sm border border-[var(--glass-border)] text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{portal.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
