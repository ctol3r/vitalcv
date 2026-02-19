import Link from 'next/link';
import { HeroSection } from '../components/marketing/HeroSection';
import { HowItWorks } from '../components/marketing/HowItWorks';
import { GraphPreview } from '../components/marketing/GraphPreview';
import { SecurityStandards } from '../components/marketing/SecurityStandards';
import { VerifierSection } from '../components/marketing/VerifierSection';

/* ─── Header ─── */
function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          VitalCV
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/clinician"
            className="hidden text-sm text-muted transition-theme hover:text-foreground md:block"
          >
            Clinicians
          </Link>
          <Link
            href="/verifier"
            className="hidden text-sm text-muted transition-theme hover:text-foreground md:block"
          >
            Verifiers
          </Link>
          <Link
            href="https://app.vitalcv.com"
            className="rounded-md border border-border bg-transparent px-3.5 py-1.5 text-sm font-medium text-foreground transition-theme hover:bg-surface"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-6 px-6 md:flex-row md:items-center">
        <span className="text-sm font-semibold text-foreground">VitalCV</span>
        <nav className="flex items-center gap-6">
          <Link
            href="/clinician"
            className="text-sm text-muted transition-theme hover:text-foreground"
          >
            Clinicians
          </Link>
          <Link
            href="/verifier"
            className="text-sm text-muted transition-theme hover:text-foreground"
          >
            Verifiers
          </Link>
          <Link
            href="https://app.vitalcv.com"
            className="text-sm text-muted transition-theme hover:text-foreground"
          >
            App
          </Link>
        </nav>
        <p className="text-sm text-muted">
          &copy; {new Date().getFullYear()} VitalCV
        </p>
      </div>
    </footer>
  );
}

/* ─── Page ─── */
export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <HowItWorks />
        <GraphPreview />
        <SecurityStandards />
        <VerifierSection />
      </main>
      <Footer />
    </>
  );
}
