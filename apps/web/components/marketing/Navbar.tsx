import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Navbar — shared marketing navigation bar.
 * Extracted as a standalone component (Wave 11 prerequisite stub).
 */
export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-[var(--cloud-dancer)]/80 border-b border-[var(--warm-charcoal)]/5">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="font-fraunces text-lg font-semibold text-[var(--warm-charcoal)] tracking-tight"
        >
          VitalCV
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm text-[var(--warm-charcoal)]/70">
          <Link href="/#how-it-works" className="hover:text-[var(--warm-charcoal)] transition-colors">
            How It Works
          </Link>
          <Link href="/#security" className="hover:text-[var(--warm-charcoal)] transition-colors">
            Security
          </Link>
          <Link href="/#portals" className="hover:text-[var(--warm-charcoal)] transition-colors">
            Portals
          </Link>
          <Link href="/developers" className="hover:text-[var(--warm-charcoal)] transition-colors font-medium">
            Developers
          </Link>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/sign-in">Sign In</Link>
        </Button>
      </div>
    </nav>
  );
}
