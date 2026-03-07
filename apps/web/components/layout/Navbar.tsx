'use client';

import { isPublicSurfacePath, isRouteActive } from '@/components/layout/publicSurfaceRoutes';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/demo', label: 'Demo' },
  { href: '/network', label: 'Network' },
  { href: '/developers', label: 'Developers' },
  { href: '/status', label: 'Status' },
  { href: '/mission-ops', label: 'Mission Ops' },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isPublicSurfacePath(pathname)) {
    return null;
  }

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[color:oklch(0.22_0.01_60_/_0.9)] text-white backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-6">
        <Link
          href="/"
          className="font-heading text-lg font-semibold tracking-tight"
          onClick={closeMenu}
        >
          VitalCV
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isRouteActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                  active ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/8 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex">
          <Link
            href="/sign-in"
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              isRouteActive(pathname, '/sign-in')
                ? 'border-white/20 bg-white text-[color:oklch(0.22_0.01_60)]'
                : 'border-white/15 bg-white/8 text-white hover:bg-white/14'
            }`}
          >
            Sign In
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full border border-white/15 p-2 text-white md:hidden"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen ? (
        <div className="border-t border-white/10 px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => {
              const active = isRouteActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    active ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/sign-in"
              onClick={closeMenu}
              className={`mt-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                isRouteActive(pathname, '/sign-in')
                  ? 'border-white/20 bg-white text-[color:oklch(0.22_0.01_60)]'
                  : 'border-white/15 bg-white/8 text-white hover:bg-white/14'
              }`}
            >
              Sign In
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
