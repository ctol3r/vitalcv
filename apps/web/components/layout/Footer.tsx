'use client';

import { isPublicSurfacePath } from '@/components/layout/publicSurfaceRoutes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PRODUCT_LINKS = [
  { href: '/passport', label: 'Check Readiness' },
  { href: '/explore', label: 'Explore Roles' },
  { href: '/employers', label: 'For Employers' },
  { href: '/pilot', label: 'Start a Pilot' },
] as const;

const COMPANY_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/updates', label: 'Updates' },
  { href: '/status', label: 'Status' },
] as const;

const RESOURCE_LINKS = [
  { href: '/developers', label: 'Developers' },
  { href: '/compliance', label: 'Compliance' },
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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-3">
            <Link href="/" className="text-lg font-semibold tracking-tight text-white">
              VitalCV
            </Link>
            <p className="text-sm text-white/50 leading-relaxed">
              Source-backed credentialing for healthcare professionals and employers.
            </p>
            <a
              href="mailto:hello@vitalcv.com"
              className="text-sm text-white/50 transition hover:text-white"
            >
              hello@vitalcv.com
            </a>
          </div>

          {/* Product */}
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">Product</p>
            <ul className="space-y-2">
              {PRODUCT_LINKS.map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-white/60 transition hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">Company</p>
            <ul className="space-y-2">
              {COMPANY_LINKS.map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-white/60 transition hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">Resources</p>
            <ul className="space-y-2">
              {RESOURCE_LINKS.map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-white/60 transition hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-white/40 text-xs">
            &copy; {new Date().getFullYear()} VitalCV &middot; Built for Healthcare Mobility
          </p>
        </div>
      </div>
    </footer>
  );
}
