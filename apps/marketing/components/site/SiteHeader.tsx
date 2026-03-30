import Link from 'next/link';

const navLinks = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/security', label: 'Security' },
  { href: 'https://vitalcv.com/employers', label: 'For Employers' },
  { href: '/contact', label: 'Contact' },
];

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          VitalCV
        </Link>

        <nav
          aria-label="Primary"
          className="order-3 flex w-full flex-wrap items-center gap-4 text-sm text-muted md:order-none md:w-auto"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-theme hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="https://vitalcv.com/passport"
            className="rounded-md border border-border bg-foreground px-3.5 py-1.5 text-sm font-medium text-background transition-theme hover:opacity-90"
          >
            Check Readiness
          </Link>
        </div>
      </div>
    </header>
  );
}
