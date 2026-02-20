import Link from 'next/link';
import { HeroSection } from '../components/marketing/HeroSection';
import { HowItWorks } from '../components/marketing/HowItWorks';
import { GraphPreview } from '../components/marketing/GraphPreview';
import { SecurityStandards } from '../components/marketing/SecurityStandards';
import { VerifierSection } from '../components/marketing/VerifierSection';

/* ─── Page ─── */
export default function Home() {
  const pageActions = [
    { href: '/demo', label: 'Try demo' },
    { href: '/security', label: 'Read security' },
    { href: '/progress', label: 'See progress' },
  ];

  return (
    <>
      <main>
        <HeroSection />
        <section className="border-t border-border py-12">
          <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-4 px-6 md:flex-row md:items-center">
            <p className="text-sm font-medium text-muted">
              YC-ready demo path:
            </p>
            <div className="flex flex-wrap gap-3">
              {pageActions.map((action) => (
                <Link
                  href={action.href}
                  key={action.href}
                  className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-theme hover:opacity-90"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
        <HowItWorks />
        <GraphPreview />
        <SecurityStandards />
        <VerifierSection />
      </main>
    </>
  );
}
