'use client';

import { isPublicSurfacePath } from '@/components/layout/publicSurfaceRoutes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const FOOTER_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/legal/dpa', label: 'DPA' },
  { href: '/legal/cookies', label: 'Cookies' },
  { href: '/pilot', label: 'Start a Pilot' },
] as const;

export default function Footer() {
  const pathname = usePathname();

  if (!isPublicSurfacePath(pathname)) {
    return null;
  }

  return (
    <footer className="mt-auto shrink-0 border-t border-border bg-card">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} VitalCV
          </p>
          <nav className="flex items-center gap-4">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <a
              href="mailto:hello@vitalcv.com"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Contact
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
