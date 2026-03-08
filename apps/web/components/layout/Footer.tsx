'use client';

import { isPublicSurfacePath } from '@/components/layout/publicSurfaceRoutes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const FOOTER_LINKS = [
  { href: '/developers#sdks', label: 'Docs' },
  { href: '/status', label: 'Status' },
  { href: '/developers', label: 'Developers' },
] as const;

export default function Footer() {
  const pathname = usePathname();

  if (!isPublicSurfacePath(pathname)) {
    return null;
  }

  return (
    <footer className="mt-auto shrink-0 border-t border-white/10 bg-[color:oklch(0.22_0.01_60)] text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-white/70">&copy; VitalCV</p>
        <div className="flex flex-wrap items-center gap-5">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-white/70 transition hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
