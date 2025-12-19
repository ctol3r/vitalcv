'use client';

import { useRole } from '@/app/providers';
import { ThemePicker } from '../ui/ThemePicker';
import { Shield } from 'lucide-react';
import Link from 'next/link';
import { VerifiedHumanBadge } from '@/components/VerifiedHumanBadge';

export default function Header() {
  const { role, setRole, roles } = useRole();

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b bg-white/70 px-4 backdrop-blur dark:bg-neutral-900/70">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <span className="font-semibold">VitalCV</span>
        </Link>
        <nav className="hidden items-center gap-2 md:flex">
          {roles.map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={[
                'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                r === role
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700',
              ].join(' ')}
            >
              {r === 'holder' ? 'Holder' : r === 'issuer' ? 'Issuer' : 'Verifier'}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <nav className="hidden items-center gap-4 text-sm md:flex">
          <Link href="/start" className="hover:text-blue-600 transition-colors">
            Get Started
          </Link>
          <Link href="/graph" className="hover:text-blue-600 transition-colors">
            Network
          </Link>
          <Link href="/workspace" className="hover:text-blue-600 transition-colors">
            Workspace
          </Link>
        </nav>
        <VerifiedHumanBadge />
        <ThemePicker />
      </div>
    </header>
  );
}

