'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Briefcase, CreditCard, Home, ShieldCheck, UserRound } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { isApplicationNotification } from '@/lib/mobile/clinician-state';

export function MobileBottomNav({ showClerkAccount = true }: { showClerkAccount?: boolean }) {
  const pathname = usePathname();
  const { unreadNotifications } = useClinicianMobile();
  const unreadApplicationCount = unreadNotifications.filter(isApplicationNotification).length;

  const NAV_ITEMS = [
    { name: 'Home', href: '/holder/home', matchPrefix: false, icon: Home },
    { name: 'Ready', href: '/holder/readiness', matchPrefix: true, icon: ShieldCheck },
    { name: 'Opportunities', href: '/holder/opportunities', matchPrefix: true, icon: Briefcase },
    { name: 'Applications', href: '/holder/applications', matchPrefix: true, icon: Bell },
    { name: 'Wallet', href: '/holder', matchPrefix: false, icon: CreditCard },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 z-50 w-full border-t border-vt-neutral-800 bg-vt-surface-ops-base/90 backdrop-blur-lg pb-safe lg:hidden"
      data-holder-mobile-bottom-nav="true"
    >
      <div className="grid h-[var(--holder-mobile-bottom-nav-height)] grid-cols-6 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === '/holder/readiness'
            ? pathname.startsWith('/holder/readiness') || pathname.startsWith('/holder/blockers/')
            : item.matchPrefix
              ? pathname.startsWith(item.href)
              : pathname === item.href;

          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 overflow-hidden px-1 transition-colors active:scale-95 ${
                isActive ? 'text-white' : 'text-vt-neutral-400 hover:text-vt-neutral-200'
              }`}
            >
              <div
                className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                  isActive ? 'bg-vt-info/10 text-vt-info shadow-sm' : ''
                }`}
              >
                <Icon
                  className={`h-5 w-5 transition-transform ${
                    isActive ? 'scale-110' : ''
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {item.href === '/holder/applications' && unreadApplicationCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-vt-info px-1 text-[9px] font-bold text-zinc-950">
                    {Math.min(unreadApplicationCount, 9)}
                  </span>
                ) : null}
              </div>
              <span className={`text-[10px] sm:text-xs font-medium tracking-wide ${isActive ? 'text-vt-info font-semibold' : ''}`}>
                {item.name}
              </span>
            </Link>
          );
        })}

        {/* Account — Manage account + Sign out (Clerk). */}
        <div className="flex flex-col items-center justify-center gap-1 px-1 text-vt-neutral-400">
          <div className="flex h-8 w-8 items-center justify-center">
            {showClerkAccount ? (
              <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: 'h-7 w-7' } }} />
            ) : (
              <UserRound className="h-5 w-5" aria-hidden="true" />
            )}
          </div>
          <span className="text-[10px] sm:text-xs font-medium tracking-wide">Account</span>
        </div>
      </div>
    </nav>
  );
}
