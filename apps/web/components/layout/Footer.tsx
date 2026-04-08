'use client';

import { isPublicSurfacePath } from '@/components/layout/publicSurfaceRoutes';
import { DeployBadge } from '@/components/layout/DeployBadge';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const FOOTER_LINKS = [
  { href: '/explore', label: 'Explore' },
  { href: '/developers', label: 'Developers' },
  { href: '/compliance', label: 'Compliance' },
  { href: '/updates', label: 'Updates' },
  { href: '/pilot', label: 'Pilot' },
  { href: '/status', label: 'Status' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const;

export default function Footer() {
  const pathname = usePathname();

  if (!isPublicSurfacePath(pathname)) {
    return null;
  }

  return (
    <footer className="mt-auto shrink-0 border-t border-border bg-vt-surface-ops-base text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <p className="text-white/70 text-sm">
              &copy; 2026 VitalCV &middot; Built for Healthcare Mobility
            </p>
            <DeployBadge />
          </div>
          <a
            href="mailto:hello@vitalcv.com"
            className="text-white/70 text-sm transition hover:text-white"
          >
            Contact
          </a>
          <div className="flex flex-wrap items-center gap-5">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-white/70 text-sm transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
