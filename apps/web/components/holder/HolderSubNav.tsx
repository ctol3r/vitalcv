'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Briefcase, CheckSquare, ClipboardList, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

const HOLDER_TABS = [
  { key: 'credentials', label: 'My Credentials', href: '/holder', icon: CreditCard },
  { key: 'checklist', label: 'Checklist', href: '/holder/checklist', icon: CheckSquare },
  { key: 'applications', label: 'Applications', href: '/holder/applications', icon: ClipboardList },
  { key: 'opportunities', label: 'Opportunities', href: '/holder/opportunities', icon: Briefcase },
] as const;

export function HolderSubNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/holder') return pathname === '/holder';
    return pathname.startsWith(href);
  }

  return (
    <nav className="mb-8 overflow-x-auto pb-1" aria-label="Holder navigation">
      <div className="flex min-w-max items-center gap-1">
        {HOLDER_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap transition-all duration-200',
                active
                  ? 'glass text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
