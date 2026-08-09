'use client';

/**
 * HolderDesktopNav — persistent workspace navigation for signed-in clinicians
 * at md+ widths.
 *
 * This is the md+ complement to MobileBottomNav: the same four primary
 * destinations, one nav model per breakpoint (A2, 2026-08-08). The eight-item
 * era — where Wallet, Readiness, Recognition, the Workbench, and a global
 * Share CTA raced Home/Profile/Roles/Updates as top-level peers — is retired;
 * those destinations are contextual now.
 *
 * Styled with Calm Wave ink/paper tokens so it reads correctly over both the
 * paper (mz-paper) and dark instrument holder pages.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { UserRound } from 'lucide-react';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { isApplicationNotification } from '@/lib/mobile/clinician-state';

interface NavItem {
  name: string;
  href: string;
  matchPrefix: boolean;
}

/**
 * The four primary destinations (audit plan 2026-08-08, product decision 2):
 * Home, Profile, Roles, Updates. Wallet, Readiness, Recognition, sharing,
 * MATCHA, and the Workbench are contextual destinations reached from the
 * surface where they advance the current task — never simultaneous global
 * peers. a2-clinician-nav-model.test.tsx guards both halves: this list stays
 * exactly four, and every demoted destination stays reachable from at least
 * one clinician surface.
 */
const NAV_ITEMS: NavItem[] = [
  { name: 'Home', href: '/holder/home', matchPrefix: false },
  { name: 'Profile', href: '/clinician/profile', matchPrefix: true },
  { name: 'Roles', href: '/holder/opportunities', matchPrefix: true },
  { name: 'Updates', href: '/holder/applications', matchPrefix: true },
];

function isItemActive(item: NavItem, pathname: string): boolean {
  return item.matchPrefix ? pathname.startsWith(item.href) : pathname === item.href;
}

export function HolderDesktopNav({ showClerkAccount = true }: { showClerkAccount?: boolean }) {
  const pathname = usePathname();
  const { unreadNotifications } = useClinicianMobile();
  // The badge sits on the Updates (applications) tab, so it counts only
  // application notifications — not the mixed feed (readiness deltas, blockers).
  const unreadApplicationCount = unreadNotifications.filter(isApplicationNotification).length;

  return (
    <nav
      aria-label="Clinician workspace"
      className="sticky top-0 z-40 hidden w-full border-b border-[var(--rule)] backdrop-blur-md lg:block"
      style={{ background: 'color-mix(in oklch, var(--card) 88%, transparent)' }}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-6 lg:px-8">
        <Link
          href="/holder/home"
          className="shrink-0 text-[17px] font-semibold tracking-tight text-[var(--ink-900)]"
          style={{ fontFamily: 'var(--font-fraunces, var(--vt-font-display, Georgia, serif))' }}
        >
          VitalCV
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative whitespace-nowrap rounded-md px-3 py-2 font-mono text-[11.5px] uppercase tracking-[0.14em] transition-colors ${
                  active
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--ink-500)] hover:text-[var(--ink-900)]'
                }`}
              >
                {item.name}
                {item.href === '/holder/applications' && unreadApplicationCount > 0 ? (
                  <span className="absolute -right-0.5 top-0.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-[var(--card)]">
                    {Math.min(unreadApplicationCount, 9)}
                  </span>
                ) : null}
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 -bottom-[9px] h-[2px] rounded-full bg-[var(--accent)]"
                  />
                ) : null}
              </Link>
            );
          })}
        </div>

        {/* Account menu — Manage account + Sign out (Clerk). */}
        {showClerkAccount ? (
          <UserButton afterSignOutUrl="/" />
        ) : (
          <UserRound className="h-5 w-5 text-[var(--ink-500)]" aria-hidden="true" />
        )}
      </div>
    </nav>
  );
}
