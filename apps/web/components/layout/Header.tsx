'use client';

import { VerifiedHumanBadge } from '@/components/VerifiedHumanBadge';
import { Shield } from 'lucide-react';
import Link from 'next/link';

const primaryLinks = [
  { href: '/clinician', label: 'Clinician' },
  { href: '/employer', label: 'Employer' },
  { href: '/issuer', label: 'Issuer' },
  { href: '/demo', label: 'Demo' },
];

const utilityLinks = [
  { href: '/start', label: 'Get Started' },
  { href: '/graph', label: 'Network' },
  { href: '/workspace', label: 'Workspace' },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b bg-white/70 px-4 backdrop-blur dark:bg-neutral-900/70">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <span className="font-semibold">VitalCV</span>
        </Link>
        <nav className="hidden items-center gap-4 text-sm md:flex">
          {primaryLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-blue-600 transition-colors">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <nav className="hidden items-center gap-4 text-sm md:flex">
          {utilityLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-blue-600 transition-colors">
              {link.label}
            </Link>
          ))}
        </nav>
        <VerifiedHumanBadge />
      </div>
    </header>
  );
}

