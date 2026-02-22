import Link from 'next/link';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/security', label: 'Security' },
  { href: '/demo', label: 'Demo' },
  { href: '/progress', label: 'Progress' },
  { href: '/clinician', label: 'Clinician' },
  { href: '/verifier', label: 'Verifier' },
  { href: '/contact', label: 'Contact' },
];

const actionLinks = [
  { href: '/demo', label: 'Try demo', tone: 'primary' },
  { href: '/security', label: 'Read security', tone: 'ghost' },
  { href: '/progress', label: 'See progress', tone: 'ghost' },
 ] as const;

function actionClass(tone: 'primary' | 'ghost'): string {
  return tone === 'primary'
    ? 'rounded-md border border-border bg-foreground px-3.5 py-1.5 text-sm font-medium text-background transition-theme hover:opacity-90'
    : 'rounded-md border border-border px-3.5 py-1.5 text-sm font-medium text-foreground transition-theme hover:bg-surface';
}

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

        <div className="flex flex-wrap items-center gap-2">
          {actionLinks.map((link) => (
            <Link
              href={link.href}
              key={link.href}
              className={actionClass(link.tone)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
