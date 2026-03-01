'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreditCard, CheckSquare, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';

const HOLDER_TABS = [
  { key: 'credentials', label: 'My Credentials', href: '/holder', icon: CreditCard },
  { key: 'checklist', label: 'Checklist', href: '/holder/checklist', icon: CheckSquare },
  { key: 'opportunities', label: 'Opportunities', href: '/holder/opportunities', icon: Briefcase },
] as const;

export function HolderSubNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/holder') return pathname === '/holder';
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex items-center gap-1 mb-8" aria-label="Holder navigation">
      {HOLDER_TABS.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
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
    </nav>
  );
}
